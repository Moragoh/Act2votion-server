<overview>
Act2votion is a companion app for a devotional text pdf.

A devotional pdf has verses for a weekday followed by some discussion questions pertaining to the date. Currently, people who use this pdf to read the Bible and reflect on it daily have to scroll down to the current date in the pdf to know what the current verse is.

Act2votion addresses this pain point: it is a widget that automatically fetches what the day's text and discussion text is and displays it.
</overview>

<main-components>
High level, there are two components: The server and the client app.

The server is in charge of:
- Fetching the newest DT pdf from the link (this link is given. The domain does not change)
- When a new DT book is fetched, it parses through it and creates a JSON file that stores what the verses and the discussion questions are for that day. 

The client app:
- Widget: Queries the server for today's text a couple times a day (a few times so that it does not get blocked by iOS) and displays it
- App: When the widget is clicked, the Act2votion app should open. The Act2votion app displays the verses, the text itself, and the discussion questions
</main-components>

<main-objective>
This repository is the server component. It should handle monitoring the pdf website to see if a new text has been uploaded. It should also handle parsing through all new pdfs and parsing them into JSON. Finally, it should have endpoints that the client app interfaces with.
</main-objective>