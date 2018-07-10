# Web Elements Extractor

A simple CSS selector scraper

The API will extract the content of CSS selectors on given pages

The API needs CSS selectors for every pages used as input

The scraping results will take this format:
```
{
	"url": http://..."
	"date": "xxx",
	"label": "xxx",
	"selector": "sel",
	"value": "awesome value from scraping process",
	"error": "Error from the scraping"
}
````

The error field is not always present