var Slack = require('slack-node');

webhookUri = process.env.WEBHOOK;

slack = new Slack();
slack.setWebhook(webhookUri);

// welcome message
function welcome() {
  slack.webhook({
    channel: "#general",
    username: "webhookbot",
    text: "This is posted to #general and comes from a bot named webhookbot."
  }, function(err, response) {
    console.log(response);
  });
}

// send message
function parseMsg(message) {
  if (message === "help") helpMsg();
  else
    slack.webhook({
      channel: "#general",
      username: "webhookbot",
      text: message
    }, function(err, response) {
      console.log(response);
    });
}

// list commands
function helpMsg() {
  slack.webhook({
    channel: "#general",
    username: "webhookbot",
    text: message
  }, function(err, response) {
    console.log(response);
  });
}

module.exports = {
  welcome,
  parseMsg
}
