import axios from 'axios';
import *_ from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const PAGE_URL = 'https://devotions.acts2.network/';
const DATA_DIR = path.resolve(__dirname, '..', 'data');

/**
 * Downloads the latest PDF from the devotions website.
 */
async function downloadLatestPdf(): Promise<string> {
  try {
    console.log(`Fetching page data from: ${PAGE_URL}`);
    const { data } = await axios.get(PAGE_URL);
    const $ = _.load(data);

    const pdfPath = $("a[href$='.pdf']").first().attr('href');

    if (!pdfPath) {
      console.error('Could not find a PDF link on the page.');
      process.exit(1);
    }

    // Dropbox links use 'dl=0' to preview. Changing to 'dl=1' forces download.
    const downloadUrl = pdfPath.replace('dl=0', 'dl=1');
    const filename = path.basename(downloadUrl.split('?')[0]);

    if (!filename) {
      console.error('Could not determine a valid filename from the URL.');
      process.exit(1);
    }

    // Ensure the data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`Creating data directory at: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const localFilePath = path.join(DATA_DIR, filename);

    console.log(`Downloading "${filename}" to "${localFilePath}"...`);

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(localFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Successfully downloaded: ${localFilePath}`);
        resolve(localFilePath);
      });
      writer.on('error', (err) => {
        console.error('Error writing file to disk.', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('An error occurred during the download process:', error);
    process.exit(1);
  }
}

// Execute the download function
downloadLatestPdf();
