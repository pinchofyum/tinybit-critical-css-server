import express from 'express';
import { generate } from 'critical';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
	res.send('This is a server that generates critical CSS');
});

app.post('/', async (req, res) => {
	console.log('POST request received');

	try {
		console.log('Trigger browser launch');

		const browser = await puppeteer.launch({
			headless: 'shell',
			executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
			],
			defaultViewport: {
				width: 1300,
				height: 900
			}
		});

		console.log('Create temp CSS file');

		const cssFile = tmp.tmpNameSync();

		await fs.promises.appendFile(cssFile, req.body.css);

		console.log('Generate critical CSS');
		console.log(browser);

		const { css } = await generate({
			concurrency: 1, // https://github.com/addyosmani/critical/issues/364#issuecomment-493865206
			css: cssFile,
			html: req.body.html,
			inline: false,
			penthouse: {
				puppeteer: {
					getBrowser: () => browser,
				}
			}
		});

		await fs.promises.unlink(cssFile);

		console.log('Send response');

		res.send({
			css: css,
		});
	} catch (err) {
		res.status(400).send(err.message);
	}
})

app.get('/debug/npm-log/:logName?', (req, res) => {
	const logName = req.params.logName || '';
	const logDir = '/root/.npm/_logs';

	const files = fs.readdirSync(logDir);
	const latestLog = files.sort().reverse()[0];
	const logPath = path.join(logDir, logName || latestLog);

	try {
		console.log( 'Reading ' + logPath );
		const logContent = fs.readFileSync(logPath, 'utf8');
		res.send(logContent);
	} catch (error) {
		res.status(500).send(`Error reading log file: ${error.message}`);
	}
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
	console.log(`tinybit-critical-css-server: listening on port ${port}`);
});
