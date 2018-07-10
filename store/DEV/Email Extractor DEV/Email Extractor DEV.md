# Email Extractor API:

This API will return every emails found on given pages

# Arguments:
- urls: URLs to scrape (or a CSV / Spreadsheet)
- timetoWait: Amount of ms to wait before scraping mails (the value is by default 5000 ms) can be used to wait the HTML loading
- pagesPerLaunch

# Output:
- CSV:
  - url (scraped URL)
  - mail (mail found in url)

mail field can have "no mails found" to tell if the API didn't found emails for a page

- Note:
 If a mail is present more than one time, it will be returned only once