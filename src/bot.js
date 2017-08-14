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
            "callback_id": "is_member",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "isTeam",
                    "text": "A Team",
                    "type": "button",
                    "value": "true"
                },
                {
                    "name": "isTeam",
                    "text": "Team Members",
                    "type": "button",
                    "value": "false"
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
  const callbackID = msg.callback_id;
  const actions = msg.actions;
  callback("Awesome!");
}

module.exports = {
  welcome,
  parseMsg,
  parseIMsg
}
