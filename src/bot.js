var Slack = require('slack-node');

webhookUri = process.env.WEBHOOK;

var slack = new Slack();
slack.setWebhook(webhookUri);

// welcome message
function welcome(user) {
  slack.webhook({
    text: `Hi ${user}!  I'm here to assist you with forming a team!\nTo start, are you looking to join a team or are you part of a team looking for team members?`,
    attachments: [
        {
            "text": "I am looking for:",
            "fallback": "The features of this app are not supported by your device",
            "callback_id": "user_type",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "choice",
                    "text": "A Team",
                    "type": "button",
                    "value": "team"
                },
                {
                    "name": "choice",
                    "text": "Team Members",
                    "type": "button",
                    "value": "member"
                }
            ]
        }
    ]
  }, function(err, response) {
    console.log(response);
  });
}

// send message
function parseMsg(message) {
  if (message === "help") helpMsg();
  else
    slack.webhook({
      text: message
    }, function(err, response) {
      console.log(response);
    });
}

// list commands
function helpMsg() {
  slack.webhook({
    text: message
  }, function(err, response) {
    console.log(response);
  });
}

// parse interactive messages
function parseIMsg(msg, callback) {
  msg = JSON.parse(msg.payload);
  const callbackID = msg.callback_id;
  const actions = msg.actions;

  if (callbackID === 'user_type') {
    setUserType(actions[0].value, callback);
  }
}


/*   Interactive Message Handlers */

function setUserType(type, callback) {
  // looking for team
  if(type === "team") callback("Looking for teams...");
  else callback("Looking for team members...");
}

module.exports = {
  welcome,
  parseMsg,
  parseIMsg
}
