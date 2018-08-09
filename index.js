'use strict';

var slack = function(auth, appName, version, url, callback) {
    var MY_SLACK_WEBHOOK_URL = auth.slack_webhookUrl;
    var slack = require('slack-notify')(MY_SLACK_WEBHOOK_URL);

    slack.send({
        text: appName + " " + version + " is released. See detail at " + url
    }, function(err){
        console.log('Slack is sent');
        callback();
    });
};

var theHub = function(auth, appName, version, appShortName, callback) {
    var jive = require("jive-simple-api");

    const fs = require('fs');

    var content = fs.readFileSync('changelog.html', 'utf8');
    content = content.replace(/__APP__SHORT__NAME__/g, appShortName);
    content = content.replace(/__APP__VERSION__/g, version);
    content = content.replace(/&/g, '&amp;');
    var subject = appName + " " + version + " Release Note";

    jive.post({
            clientId: auth.clientId,
            clientSecret: auth.clientSecret,
            refreshToken: auth.refreshToken,
            tokenUrl: auth.tokenUrl,
            url: auth.url,
            jive_opts: {
                content: {
                    type: "text/html",
                    text: content
                },
                subject: subject,
                type: "document",
                parent: "https://thehub.thomsonreuters.com/api/core/v3/places/4608503",
                tags: ['calc-release-note', appShortName]
            }
        },
        function(error, result) {
            if (error) {
                console.log(error);
                callback(error, null)
                return;
            }
            console.log(JSON.stringify(result));
            callback(null, result.resources.html.ref);
        });
};

let create = function(auth, appJsonObj, releaseJsonObj, callback) {

    if (!auth || !appJsonObj || !releaseJsonObj) {
        console.log('Error - no needed files');
        return;
    }

    var semver = require('semver');

    if (semver.lte(appJsonObj.version, releaseJsonObj.version)) {
        console.log(appJsonObj.version + ' is less than or equal to ' + releaseJsonObj.version);
        console.log('Skip this schedule');
        callback("error");
        return;
    }
    console.log('OK Building the release note from tag ' + releaseJsonObj.version + ' to ' + appJsonObj.version);

    var appName = appJsonObj.displayName;
    var appShortName = appJsonObj.name;

    var execCmd = 'jira-changelog --range ' + releaseJsonObj.version + '...' + appJsonObj.version + ' --header "' + appName + '" >> changelog.html';

    var code;
    const execSync = require('child_process').execSync;
    try {
        code = execSync(execCmd).toString();
    } catch (e) {
        callback(e.message);
        return;
    }

    theHub(auth, appName, appJsonObj.version, appShortName, function(error, url) {
        if (error) {
            callback(error);
            return;
        }

        // Notify via Slack
        slack(auth, appName, appJsonObj.version, url, function() {
            callback(null, { status: 200, message: 'ok'});
        });
    });
};

module.exports = {
    create: create
};