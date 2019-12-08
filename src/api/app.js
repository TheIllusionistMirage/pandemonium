"use strict";

/**
 * Pandemonium API
 * ---------------
 * TODO: Add doc
 */

import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import fs from "fs";
import childProcess from 'child_process';
import ytdl from "ytdl-core";
import uuid4 from 'uuid/v4';

// Read API configuration
import config from "./config.json";

// App
const api = express();
api.use(bodyParser.json());
// Allow CORS
api.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin,X-Requested-With,Accept,X-Powered-By,Allow,Content-Type,Content-Length,ETag,Date,Connection"
    );
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Content-Type", "application/json");
    next();
});

// Cache
let urlMap = {};

// Health check
api.get("/healthCheck", (req, res) => {
    res.send({ status: "OK", message: "Pandemonium API is running" });
});

// Search
api.post("/search", (req, res) => {
    const term = req.body.term;
    const maxResults = req.body.maxResults;
    console.log(`\nSearch operation initiated, search term: ${term}`);

    const apiSearchUrl = `https://www.googleapis.com/youtube/v3/search?q=${term}&type=video&maxResults=${maxResults}&part=snippet&key=${config.apiKey}`;

    axios
        .get(apiSearchUrl)
        .then(response => {
            const apiResponseData = {
                results: []
            };

            for (var i = 0; i < response.data.items.length; ++i) {
                let item = response.data.items[i];
                let resultObj = {
                    id: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: {
                        url: item.snippet.thumbnails.high.url,
                        width: item.snippet.thumbnails.high.width,
                        height: item.snippet.thumbnails.high.height
                    }
                };

                apiResponseData.results.push(resultObj);
            }

            res.send(apiResponseData);
        })
        .catch(error => {
            console.log(`Errors occured: ${JSON.stringify(error)}`);
            res.status(500).send(error);
        })
        .finally(() => {
            console.log(`Performed search on search term: ${term}`);
        });
});

// Stream1
api.get("/stream1", (req, res) => {
    console.log(`Stream request received for video ID: ${req.body.id}`);
    stream(req.body.id, req, res);
});

// Stream2
api.get('/stream2/:videoId', (req, res) => {
    console.log(`Stream request received for video ID: ${req.params.videoId}`);
    stream(req.params.videoId, req, res);
});

api.listen(config.port, () => {
    console.log("Started Pandemonium API service.");
    console.log(`Running on port: ${config.port}`);
});

// Clear cache
api.get('/clearCache', (req, res) => {
    console.log('Clear cache request received');
    const command = `rm -r ${config.cache}/*`;

    childProcess.execSync(command, (err, stdout, stderr) => {
        if (err) {
            console.log(`- Child process ${ command } failed to execute with status code ${ err.code }, error: ${ JSON.stringify(err, null, 4) }\n`);
            res.status(502).send({
                'status': 'failure',
                'message': 'Clear cache operation failed.',
                'error': err
            });
        }

        console.log(`\n- Child process \'${ command }\' execution result:\n${ stdout }\n`);
    });

    urlMap = {};
    const msg = `Successfully reset content cache: ${config.cache}`;
    console.log(msg);
    res.send({ status: "OK", message: msg });
});

// Helpers

const stream = (id, req, res) => {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    let videoFileName = `${config.cache}/${ uuid4() }`;
    const command = `youtube-dl ${ videoUrl } -f 'bestaudio' -o '${ videoFileName }'`;

    if (!urlMap[videoUrl]) {
        urlMap[videoUrl] = videoFileName;
        childProcess.execSync(command, (err, stdout, stderr) => {
            if (err) {
                console.log(`- Child process ${ command } failed to execute with status code ${ err.code }, error: ${ JSON.stringify(err, null, 4) }\n`);
                res.status(502).send({
                    'status': 'failure',
                    'videoUrl': videoUrl,
                    'error': err
                });
            }
    
            console.log(`\n- Child process \'${ command }\' execution result:\n${ stdout }\n`);
        });
    }
    else {
        videoFileName = urlMap[videoUrl];
    }

    partialTransfer(req, res, videoFileName);
    console.log('Content cache: ');
    console.log(urlMap);
}

// "Copied" partial transfer code from: https://github.com/daspinola/video-stream-sample/blob/master/server.js
const partialTransfer = (req, res, videoFileName) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "audio/webm");
    res.set("Accept-Ranges", "bytes");

    const stat = fs.statSync(videoFileName);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = end - start + 1;
        res.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.set("Content-Length", chunksize);

        res.status(206);
        fs.createReadStream(videoFileName, { start, end }).pipe(res);
    } else {
        res.set("Content-Length", fileSize);
        fs.createReadStream(videoFileName).pipe(res);
    }
}