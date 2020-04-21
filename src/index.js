const puppeteer = require('puppeteer-core');
const _cliProgress = require('cli-progress');
const spintax = require('mel-spintax');
var spinner = require("./step");
var utils = require("./utils");
var qrcode = require('qrcode-terminal');
var path = require("path");
var argv = require('yargs').argv;
var rev = require("./detectRev");
var constants = require("./constants");
require('dotenv').config()
const { createLogger, transports ,format} = require('winston');
const { combine, timestamp, json, simple } = format;
const express = require('express');
const app = express()
const port = 3000
var bodyParser = require('body-parser');

const logger = createLogger({
  level: 'info',
  format: combine(
    json(),
    timestamp()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'activity.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: simple()
  }));
}

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/login.html'));
});

app.post("/auth", function(req, res, next) {
  var id = req.body.u;
  var pw = req.body.p;
  if(id == "evercam" && pw == process.env.LOG_PASSWORD) {
    res.sendFile(path.join(__dirname + '/../activity.log'))
  }
  else {
    logger.log("error", "Invalid credentials")
  }
});

async function Main() {
  
    try {
        var page;
        await downloadAndStartThings();
        var isLogin = await checkLogin();
        if (!isLogin) {
            await getAndShowQR();
        }
        console.log("Evercam WhatsApp bot is ready.");
    } catch (e) {
        console.error("\nLooks like you got an error. " + e);
        try {
            page.screenshot({ path: path.join(process.cwd(), "error.png") })
        } catch (s) {
            console.error("Can't create shreenshot, X11 not running?. " + s);
        }
        console.warn(e);
        console.error("Don't worry errors are good. They help us improve. A screenshot has already been saved as error.png in current directory. Please mail it on vasani.arpit@gmail.com along with the steps to reproduce it.\n");
        throw e;
    }

    async function downloadAndStartThings() {
        var botjson = await utils.externalInjection("bot.json");
        botjson["evercam_url"] =  process.env.EVERCAM_URL
        botjson["token"] = process.env.WHATSAPP_TOKEN
        botjson["phone_number"] = process.env.PHONE_NUMBER
        spinner.start("Downloading chrome\n");
        const browserFetcher = puppeteer.createBrowserFetcher({
            path: process.cwd()
        });
        const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_grey);
        progressBar.start(100, 0);
        var revNumber = await rev.getRevNumber();
        const revisionInfo = await browserFetcher.download(revNumber, (download, total) => {
            var percentage = (download * 100) / total;
            progressBar.update(percentage);
        });
        progressBar.update(100);
        spinner.stop("Downloading chrome ... done!");
        spinner.start("Launching Chrome");
        var pptrArgv = [];
        if (argv.proxyURI) {
            pptrArgv.push('--proxy-server=' + argv.proxyURI);
        }
        const extraArguments = Object.assign({});
        extraArguments.userDataDir = constants.DEFAULT_DATA_DIR;
        const browser = await puppeteer.launch({
            executablePath: revisionInfo.executablePath,
            headless: botjson.appconfig.headless,
            userDataDir: path.join(process.cwd(), "ChromeSession"),
            devtools: false,
            args: [...constants.DEFAULT_CHROMIUM_ARGS, ...pptrArgv], ...extraArguments
        });
        spinner.stop("Launching Chrome ... done!");
        if (argv.proxyURI) {
            spinner.info("Using a Proxy Server");
        }
        spinner.start("Opening Whatsapp");
        page = await browser.pages();
        if (page.length > 0) {
            page = page[0];
            page.setBypassCSP(true);
            if (argv.proxyURI) {
                await page.authenticate({ username: argv.username, password: argv.password });
            }
            page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36");
            await page.goto('https://web.whatsapp.com', {
                waitUntil: 'networkidle0',
                timeout: 0
            });
            page.evaluate("var intents = " + JSON.stringify(botjson));
            spinner.stop("Opening Whatsapp ... done!");
            page.exposeFunction("log", (message) => {
                logger.log("info", message)
            })
            page.exposeFunction("getFile", utils.getFileInBase64);
            page.exposeFunction("resolveSpintax", spintax.unspin);
        }
    }

    async function injectScripts(page) {
        return await page.waitForSelector('[data-icon=laptop]')
            .then(async () => {
                var filepath = path.join(__dirname, "WAPI.js");
                await page.addScriptTag({ path: require.resolve(filepath) });
                filepath = path.join(__dirname, "inject.js");
                await page.addScriptTag({ path: require.resolve(filepath) });
                return true;
            })
            .catch(() => {
                console.log("User is not logged in. Waited 30 seconds.");
                return false;
            })
    }

    async function checkLogin() {
        spinner.start("Page is loading");
        await utils.delay(10000);
        var output = await page.evaluate("localStorage['last-wid']");
        if (output) {
            spinner.stop("Looks like you are already logged in");
            await injectScripts(page);
        } else {
            spinner.info("You are not logged in. Please scan the QR below");
        }
        return output;
    }

    async function getAndShowQR() {
        var scanme = "img[alt='Scan me!'], canvas";
        await page.waitForSelector(scanme);
        var imageData = await page.evaluate(`document.querySelector("${scanme}").parentElement.getAttribute("data-ref")`);
        //console.log(imageData);
        qrcode.generate(imageData, { small: true });
        spinner.start("Waiting for scan \nKeep in mind that it will expire after few seconds");
        var isLoggedIn = await injectScripts(page);
        while (!isLoggedIn) { 
            await utils.delay(300);
            isLoggedIn = await injectScripts(page);
        }
        if (isLoggedIn) {
            spinner.stop("Looks like you are logged in now");
        }
    }
}

Main();
