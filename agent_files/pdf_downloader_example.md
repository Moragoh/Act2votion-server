import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const PAGE = "https://devotions.acts2.network/";


const { data } = await axios.get(PAGE);
const $ = cheerio.load(data);


const pdfUrl = $("a[href$='.pdf']").first().attr("href");


if (!pdfUrl) {
console.log("No PDF found");
process.exit();
}


const url = pdfUrl.replace("dl=0", "dl=1");
const filename = url.split("/").pop().split("?")[0];


const res = await axios({ url, method: "GET", responseType: "stream" });


res.data.pipe(fs.createWriteStream(filename));


console.log("Downloading:", filename);



