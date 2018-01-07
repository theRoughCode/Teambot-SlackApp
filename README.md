# Teambot

Teambot is the revamped Slack version of [MayBot](https://github.com/theRoughCode/maybot).  Teambot is a Slack app that hackathons
can use within their hackathon Slack to help hackers get matched based on roles and skills.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

You'll need Node.js and npm (a package manager for JavaScript).  You can download Node.js from [here](https://nodejs.org) which includes npm.

### Installing

A step by step series of examples that tell you have to get a development env running

1. Download this repo locally.
2. Install node modules.

```
npm install
```

3. Create a firebase project and generate your service account credentials.  
(More info [here](https://firebase.google.com/docs/admin/setup))
4. Download your service account credentials.
5. Create a new Slack app [here](https://api.slack.com/apps).
6. Create a `.env` file in the main directory of the project and include the following key-value pairs:<br />
  i. `PORT` - define the port used for the local server<br />
  ii. `API_TOKEN` - token used to connect to your hackathon's Slack.
  Create a token [here](https://api.slack.com/custom-integrations/legacy-tokens)<br />
  iii. `FIREBASE` - copy and paste the JSON within the Firebase service account credentials you downloaded in step 4.<br />
  iv. `BOT_CHANNEL_NAME` - name of channel within your Slack.<br />
  v. `RAPH_NAME` - Slack username of bot rep.  Any errors will be sent to this user.<br />
  vi. `DB_NAME` - name of hackathon
```
PORT=8000
API_TOKEN=enter_token_here
FIREBASE={"type": "service_account", "project_id": "some_id", "private_key_id": "some_key", "private_key": "-----BEGIN PRIVATE KEY-----\nsome_private_key\n-----END PRIVATE KEY-----\n",   "client_email": "some_email", "client_id": "some_client_id", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://accounts.google.com/o/oauth2/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_x509_cert_url": "some_url"}
BOT_CHANNEL_NAME=looking-for-team
RAPH_NAME=raphael
DB_NAME="Hack the North"
```

## Deployment

### Local Deployment
For local deployment, download [ngrok](https://ngrok.com/).
1. `npm start` or `nodemon` (more info on nodemon [here](https://nodemon.io/))
2. `./ngrok http 8000` where `8000` is the port name you defined within your `.env` file.
3. Open `http://localhost:4040` in your browser.  This keeps track of the http requests made to your local server and the responses.
4. Copy the webhook given to you by ngrok.
5. In your Slack app dashboard, go to _Features_ -> _Interactive Components_, and input `http://{webhook}.ngrok.io/interact` under _Request URL_.
6. _Features_ -> _Slash Commands_ -> _Create New Command_, and enter the following:
    1. Command: `/teambot`
    2. Request URL: `http://{webhook}.ngrok.io/slash`
    3. Short Description: `Manage team formation`
    4. Usage Hint: `[start, help, list]`
7. _Features_ -> _OAuth & Permissions_ -> _Scopes_, add the following scopes:
    - commands
    - incoming-webhook
    - channels:read
    - chat:write:bot
    - chat:write:user
    - groups:read
    - im:history
    - im:read
    - im:write
    - users.profile:read
8. _Features_ -> _Event Subscriptions_, turn *Enable Events* on.
9. Input the _Request URL_ as `http://2c20523c.ngrok.io/events`.
10. Subscribe to the `member_joined_channel` and `member_left_channel` events.
11. Type `/teambot` in the bot channel to begin the conversation!

### Live Deployment
1. Host it using a web hosting service like [Heroku](heroku.com)
2. Replace all `ngrok` endpoints in the above steps with your live web URL.
3. Type `/teambot` in the bot channel to begin the conversation!

## Built With

* [JavaScript](https://www.javascript.com/) - The language of choice
* [Node.js](https://nodejs.org) - Our server framework
* [npm](https://www.npmjs.com/) - Package manager
* [Slack API](https://api.slack.com/web) - API to communicate with Slack

## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.


## Authors

* **Raphael Koh** - *Initial work and Project Owner* - [TheRoughCode](https://github.com/theRoughCode)
* **Clayton Halim** - *Initial work* - [Clayton-Halim](https://github.com/clayton-halim)

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* The Hack the North team for helping me test the app!
