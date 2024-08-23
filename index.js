import express from 'express';
import { generate } from 'critical';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import tmp from 'tmp';
import chromium from '@sparticuz/chromium';

const app = express();

app.use(express.json({ limit: '10mb' }));

async function getBrowser() {
	try {
		const browser = await puppeteer.launch({
			args: chromium.args,
			executablePath: await chromium.executablePath(),
			headless: chromium.headless,
			ignoreHTTPSErrors: true,
		});

		const version = await browser.version();
		console.log('Browser version:', version);

		return browser;
	} catch (error) {
		console.log('Error launching browser:', error);
	}
}

app.get('/', (req, res) => {
	res.send('This is a server that generates critical CSS');
});

app.post('/', async (req, res) => {
	let browser;
	let cssFile;

	try {
		console.log('Trigger browser launch');

		browser = await getBrowser();

		cssFile = tmp.tmpNameSync();
		await fs.promises.writeFile(cssFile, req.body.css);

		console.log('Generate critical CSS');

		const { css } = await generate({
			concurrency: 1, // https://github.com/addyosmani/critical/issues/364#issuecomment-493865206
			css: cssFile,
			html: req.body.html,
			inline: false,
			width: 1300,
			height: 900,
			penthouse: {
				puppeteer: {
					getBrowser: async () => browser,
				},
			}
		});

		res.send({
			css: css,
		});
	} catch (err) {
		console.error('Error:', err);
		res.status(500).send(`Error: ${err.message}`);
	} finally {
		if (browser) {
			try {
				await browser.close();
				console.log('Browser closed');
			} catch (closeErr) {
				console.error('Error closing browser:', closeErr);
			}
		}
	}
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
	console.log(`tinybit-critical-css-server: listening on port ${port}`);
});
