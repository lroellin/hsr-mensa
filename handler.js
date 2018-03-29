const AWS = require('aws-sdk');
const request = require('request')
const rp = require('request-promise');
const cheerio = require('cheerio')
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const BUCKETNAME = 'hsr-mensa'
const KEY = 'mensa.json'

const URLS = ['http://hochschule-rapperswil.sv-restaurant.ch/de/menuplan/mensa/', 'http://hochschule-rapperswil.sv-restaurant.ch/de/menuplan/forschungszentrum/']

exports.run = (event, context, callback) => {
    const canteens = { 'canteens': [], 'latestUpdate': Date.now() }

    const promises = []

    URLS.forEach(url => {
        promises.push(rp(url))
    })

    Promise.all(promises).then(values => {
        values.forEach(html => {
            const canteen = {
                'menus': []
            }
            const dom = cheerio.load(html, { normalizeWhitespace: true, decodeEntities: false })
            const name = dom('div.restaurant-nav a.act').text()
            canteen.name = name
            const todayItems = dom('div#menu-plan-tab1 div.item-content')
            todayItems.toArray().forEach((element) => {
                const menu = {}
                menu.title = entities.decode(cheerio('h2.menu-title', element).text())
                menu.description = entities.decode(cheerio('p.menu-description', element).text())
                canteen['menus'].push(menu)
            })

            canteens['canteens'].push(canteen)
        })
        putObjectToS3(BUCKETNAME, KEY, JSON.stringify(canteens))
        callback(null, JSON.stringify(canteens))
    }, error => {
        callback(error)
    })
};

const putObjectToS3 = (bucket, key, data) => {
    const s3 = new AWS.S3();
    const params = {
        ACL: "public-read", 
        Bucket: bucket,
        Key: key,
        Body: data
    }
    s3.putObject(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log(data); // successful response
    });
}
