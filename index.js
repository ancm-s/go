'use strict';
require('dotenv').config({ silent: true });
const http = require('http');
const Router = require('router');
const finalhandler = require('finalhandler');
const shortid = require('shortid');
const level = require('level');
const sublevel = require('level-sublevel');
const db = sublevel(level('./db'));
const parse = require('url').parse;
const view = require('consolidate');
const helmet = require('helmet');
const nf = require('number-format');
const lastStat = 0;

const app = new Router();
const server = http.createServer((req, res) => {
    app(req, res, finalhandler(req, res));
});
const io = require('socket.io')(server);

app.use(helmet());
app.use((req, res, next) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type');
    res.setHeader("Content-Type", "text/html; chartset=utf-8");

    next();
});


app.get('/', (req, res, next) => {
    getShorted()
        .then((shorted) => {
            view.mustache('./view/home.html', { shorted, domain: process.env.DOMAIN ,hostname: parse(process.env.DOMAIN).hostname}, (err, html) => {
                if (err) return next(err);
                res.end(html);
            });
        });
});

app.all('/api/shorten', (req, res, next) => {
    let params = parse(req.url, true).query,
        url;
    if (params.url && (url = createUrl(params.url))) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url }));
    } else {
        next();
    }
});
app.get('/:id', (req, res, next) => {
    db.get(req.params.id, (err, url) => {
        if (err) return next();
        res.setHeader('Location', url);
        res.statusCode = 301;
        res.end();
    });
});


function createUrl(url) {
    if (/(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/.test(url) != true) return !1;
    let id = shortid.generate();
    db.put(id, url);
    setTimeout(emitStat, 100);
    return `${process.env.DOMAIN + id}`;
}

function emitStat() {
    getShorted()
        .then((shorted) => io.emit('update shorted', { shorted }));
    return true;
}

function getShorted() {
    let shorted = 0;
    return new Promise((resolve, reject) => {
        db.createReadStream({ values: false })
            .on('data', () => ++shorted)
            .on('end', function() {
                resolve(nf.numberFormat(shorted));
            });
    });
}

server.listen(process.env.PORT || 3000, function() {
    console.log('app started');
});
