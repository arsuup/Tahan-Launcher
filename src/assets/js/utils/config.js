const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
import database from './database.js';

let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url
let config = `${url}/config`;

class Config {
    constructor() {
        this.db = new database();
        this.ready = this.init();
    }

    async init() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let accountType = auth?.meta?.type;
        this.crack = accountType === 'Mojang';
        const id = this.crack ? auth.name : auth.uuid;
        
        this.newsUrl = `${url}/news?auth=${id}`;
        this.InstancesUrl = `${url}/instances?auth=${id}`;
    }

    async ensureReady() {
        await this.ready;
    }

    async GetConfig() {
        const res = await nodeFetch(config);
        if (res.status !== 200) throw new Error('server not accessible');
        return res.json();
    }

    async getInstanceList() {
        await this.ensureReady();
        const res = await nodeFetch(this.InstancesUrl);
        const instances = await res.json();
        return Object.values(instances);
    }

    async getNews(config) {
        if (config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async config => {
                    if (config.status === 200) {
                        let news = [];
                        let response = await config.text()
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            })
                        }
                        return resolve(news);
                    }
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(this.newsUrl).then(async config => {
                    if (config.status === 200) return resolve(config.json());
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }
}

export default new Config;