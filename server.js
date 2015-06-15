var express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    redisStore = require('connect-redis')(session),
    passport = require('passport'),
    localStrategy = require('passport-local'),
    redis = require('redis'),
    morgan = require('morgan')

var client = redis.createClient();
client.on('error', function(err) {
  console.log('Redis error', err);
});

var MAX_LATEST = 5;

/*
 * Return array of articles with most reads, each object with keys:
 * {
 *   id: article id,
 *   reads: number of reads
 * }
 */
var getMostRead = function(cb) {
  // Get reverse sorted range from sorted set where read count is used as score
  client.zrevrange('articles:reads', 0, MAX_LATEST - 1, 'withscores', function(err, res) {
    var mostRead = [];
    for (var i = 0; i < res.length; i++) {
      mostRead.push({id: res[i], reads: res[i + 1]});
      i++;
    }
    cb(null, mostRead);
  });
};

/*
 * Get last read for user
 */
var getLastRead = function(user, cb) {
  // Get range from latest reads by user list
  client.lrange('user:' + user + ':lastread', 0, MAX_LATEST - 1, cb);
};

/*
 * Get all existing tags (single list)
 */
var getTags = function(cb) {
  // Get all members of 'tags' set
  client.smembers('tags', cb);
};

/*
 * Get latest articles (return list of IDs)
 */
var getLatest = function(cb) {
  // Get range from latest article list
  client.lrange('articles:latest', 0, MAX_LATEST - 1, cb);
};

/*
 * Get article and tags  Return object
 * {
 *   id: id,
 *   text: article body,
 *   tags: list of tags
 * }
 */
var getArticle = function(id, cb) {
  // Get the article
  client.get('articles:' + id, function(err, article) {
    if (err) return cb(err);
    // Get it's tags from set
    client.smembers('articles:' + id + ':tags', function(err, tags) {
      if (err) return cb(err);
      cb(null, {id: id, text: article, tags: tags})
    });
  });
};

/*
 * Get article IDs by tag (list if IDs)
 */
var getArticlesByTag = function(tag, cb) {
  // Get all members of a certain tag from set
  client.smembers('tags:' + tag + ':articles', cb);
};

/*
 * Log a read for given article and user
 */
var logRead = function(id, user) {
  // Push to the list of last reads by user
  client.lpush('user:' + user + ':lastread', id);
  // Trim the list to contain only what is needed
  client.ltrim('user:' + user + ':lastread', 0, MAX_LATEST - 1);
  // Use sorted set for article read count
  client.zincrby('articles:reads', 1, id);
};

/*
 * Add new article with tags
 */
var addArticle = function(body, tags) {
  console.log('Add article with tags ', tags);

  var id = new Date().getTime();
  // Store the article in single string
  client.set('articles:' + id, body);
  // Store article tags in set
  client.sadd('articles:' + id + ':tags', tags);
  // Store the article ID for each tag (in set)
  for (var i = 0; i < tags.length; i++) {
    client.sadd('tags:' + tags[i] + ':articles', id);
  }
  // Keep all seen tags in a set
  client.sadd('tags', tags);
  // Push the ID to the latest
  client.lpush('articles:latest', id);
  // Trim the latest to only hold whats needed
  client.ltrim('articles:latest', 0, MAX_LATEST - 1);
  return;
};

passport.deserializeUser(function(username, cb) {
  client.hgetall('users:' + username, cb);
});

passport.serializeUser(function(user, cb) {
  return cb(null, user.username);
});

passport.use(new localStrategy(function (username, password, cb) {
  client.hset('users:' + username, 'username', username, function(err, res) {
    if (err) {
      console.log(err);
      return cb(err);
    }
    return cb(null, {username: username});
  });
}));

var app = express();
app.use(morgan('combined'));
app.set('views', './views');
app.set('view engine', 'jade');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  store: new redisStore(),
  secret: 'secret-hash-key',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.post('/login', passport.authenticate('local'), function(req, res) {
  res.redirect('/');
});

app.all('*', function(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect('/login');
  }
});

app.get('/articles/tag/:tag', function(req, res) {
  getArticlesByTag(req.params.tag, function(err, articles) {
    if (err) console.log(err);
    res.render('tag', {articles: articles, tag: req.params.tag});
  });
});

app.get('/articles/:id', function(req, res) {
  getArticle(req.params.id, function(err, article) {
    if (err) console.log(err);
    logRead(req.params.id, req.user.username);
    res.render('article', {article: article});
  });
});

app.post('/articles', function(req, res) {
  addArticle(req.body.text, req.body.tags.replace(/,/g, ' ').split(/\s+/).map(function (t) { return t.trim(); }));
  res.redirect('/');
});

app.get('/', function(req, res) {
  // This callback chain is stupid but irrelevant for the point
  getLatest(function(err, latest) {
    if (err) console.log(err);
    getTags(function(err, tags) {
      if (err) console.log(err);
      getMostRead(function(err, mostRead) {
        if (err) console.log(err);
        getLastRead(req.user.username, function(err, lastRead) {
          if (err) console.log(err);
          res.render('index', {
            user: req.user,
            latest: latest,
            lastRead: lastRead,
            tags: tags,
            mostRead: mostRead
          });
        });
      });
    });
  });
});

app.listen(8000);
console.log('App listening on port 8000');
