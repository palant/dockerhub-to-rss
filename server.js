#!/usr/bin/env node

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const request = require("request-promise-native");
const {escape} = require("./utils");

let configpath = path.join(__dirname, "config.json");
let config;
try
{
  config = JSON.parse(fs.readFileSync(configpath));
}
catch (e)
{
  console.error(`Failed reading config file ${configpath}.`);
  console.error(e);
}

http.createServer(function handleRequest(req, res)
{
  let requests = [];
  for (let repo of Object.keys(config.repositories))
  {
    let filter = new RegExp(config.repositories[repo]);

    let slug = repo.indexOf("/") < 0 ? `library/${repo}` : repo;
    requests.push(request({
      method: "GET",
      uri: `https://hub.docker.com/v2/repositories/${slug}/tags/?page_size=250`,
      transform: JSON.parse
    }).then(tags =>
    {
      let results = [];
      for (let result of tags.results)
      {
        if (filter.test(result.name))
        {
          results.push({
            repo,
            title: `${repo} ${result.name}`,
            date: new Date(result.last_updated),
            url: `https://hub.docker.com/r/${slug}/tags/`
          });
        }
      }
      return results;
    }));
  }

  Promise.all(requests).then(results =>
  {
    let entries = [];
    for (let result of results)
      entries.push(...result);
    entries.sort((a, b) => b.date - a.date);

    let html = "";
    for (let entry of entries)
    {
      html += `
        <entry>
          <author><name>"${escape(entry.repo)}" &lt;&gt;</name></author>
          <published>${escape(entry.date.toISOString())}</published>
          <updated>${escape(entry.date.toISOString())}</updated>
          <link rel="alternate" type="text/html" href="${escape(entry.url)}" />
          <id>${escape(entry.title)}</id>
          <title type="text">${escape(entry.title)}</title>
        </entry>`;
    }

    res.writeHead(200, {
      "Content-Type": "application/atom+xml; charset=utf-8"
    });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title type="text">Docker Hub updates</title>
        <link rel="self" href="http://${config.ip}:${config.port}/" />
        <link rel="alternate" type="text/html" href="https://hub.docker.com/" />
        <id>http://${config.ip}:${config.port}/</id>
        <updated>${escape(new Date().toISOString())}</updated>
        ${html}
      </feed>`, "utf-8");
  }).catch(err =>
  {
    console.error(err);
    res.writeHead(500);
    res.end();
  });
}).listen(config.port, config.ip);
