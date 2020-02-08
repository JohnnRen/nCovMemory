const Papa = require('papaparse');
// const Mustache = require('Mustache');
const Handlebars = require('handlebars');
const { differenceInDays, parse, compareDesc } = require('date-fns');
const path = require('path');
const README_PATH = path.join(__dirname, '..', 'README.md');
const CSV_PATHS = require('../data/index');
var querystring = require('querystring');
var fs = require('fs');

Papa.parsePromise = function(file, options) {
  return new Promise(function(complete, error) {
    Papa.parse(file, { complete, error, ...options });
  });
};
Handlebars.registerHelper('encode', function(string) {
  return (string = string.replace(/[\(|\)|（|）]/g, ''));
});
async function parseData(csvPath) {
  let now = new Date();
  let csv = fs.readFileSync(csvPath, 'utf8');
  let data = await Papa.parsePromise(csv, { header: true });
  data.data = data.data.filter((entry) => entry.title && entry.media && entry.date && entry.update);
  let medias = [];
  for (let entry of data.data) {
    entry.is_new = differenceInDays(now, parse(entry.update, 'MM-dd', new Date())) <= 1;
    entry.is_deleted = entry.is_deleted === 'true' || entry.is_deleted === 'TRUE';
    entry.screenshot = entry.screenshot ? `/archive/png/${entry.screenshot}.png` : null;
    entry.title = entry.title.replace('|', '\\|');

    if (medias.indexOf(entry.media) === -1) {
      medias.push(entry.media);
    }
  }
  medias.sort(function compareFunction(param1, param2) {
    return param1.localeCompare(param2, 'zh');
  });

  let articles = {};
  for (media of medias) {
    articles[media] = data.data.filter((entry) => entry.media === media);
    articles[media].sort((a, b) =>
      compareDesc(parse(a.date, 'MM-dd', new Date()), parse(b.date, 'MM-dd', new Date()))
    );
  }
  return { medias, articles };
}
async function generate() {
  let model = {};
  for (key in CSV_PATHS) {
    let result = await parseData(CSV_PATHS[key].path);
    model[key] = {
      ...result
    };
  }
  let template = fs.readFileSync(
    path.join(__dirname, '..', 'template', 'README.handlebars'),
    'utf8'
  );
  let runtime = Handlebars.compile(template);
  const output = runtime(model);
  fs.writeFileSync(README_PATH, output, 'utf-8');
}

generate();
