# Redis test app

```
npm install
npm start
```

Open [http://localhost:8000](http://localhost:8000)


## Instructions

Open `server.js` and implement the functions with comments in the beginning

The app contains articles consisting of a body and list of tags.

The front has following features:
- Add new article
    - calls `addArticle` which should store enough information for getting the article and it's tags by article ID, get list of articles for given tag, and list 5 latest article IDs.
- Latest articles
    - calls `getLatest` that should return IDs of 5 latest articles
- Last read by you
    - calls `getLastRead` that should return IDs of 5 articles last read by user
- Most read articles
    - calls `getMostRead` that should return article ID and number of reads, sorted
- Tags
    - calls `getTags` that should return all existing tags

There is a page which can list articles for given tag. This calls `getArticlesByTag` that should return list of article IDs for given tag

Single article page calls `getArticle` and `logRead`. `getArticle` should return the article body and list of tags. `logRead` just logs reads for articles so that we can get most read articles as well as latest articles read by user.

Redis client used is [https://github.com/mranney/node_redis](https://github.com/mranney/node_redis).

Data types probably used in the implementation are
- String
- List
- Set
- Sorted set
