<overview>
This is a loose overview of which milestones need to be completed before the app is compelte
</overview>

<pdf-download>
We first need to make sure that we can download pdfs from the website. This milestone will ensure that we can download pdfs and convert them to json.

</pdf-download>

<parse-json>
This milestone is about taking the json output of the pdf download and parsing the verse and discussion questions for each day into anoter json file.

Heuristics for extracting the discussion questions for each day must be figured out.
</parse-json>

<jobs>
Now that we have the pdf download and the parsing working, it's time to write a scheduler that orchestrates fetch → parse → store pipeline; decides if downloaded PDF is new.

The scheduler should call this fetch -> decide to keep -> parse -> store pipeline ocne a day at 00:00AM
</jobs>

<api>
Now we have to write apis that the front end can query for the verse / discussion questions of the day.
</api>
