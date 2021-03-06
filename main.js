// Anbindung von Unify Circuit an ioBroker
// ---------------------------------------
// 
// Dokumentation der Circuit API:
// https://circuitsandbox.net/sdk/classes/Client.html#index
// 
// Die Circuit Anbindung orientiert sich am Beispiel vom Circuit Xlator-Bot Script (automatische Übersetzung von Posts per Google Translate):
// https://github.com/circuit/xlator-bot/blob/master/index.js
//
// ---------------------------------------
//
// Typdefinitionen im Skript auf Basis von JSDoc Support in Javascript:
// https://github.com/Microsoft/TypeScript/wiki/JSDoc-support-in-JavaScript
//

"use strict";

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

// node utils
// const util = require("util");

// Circuit Posts enthalten einfache HTML Formatierungen, wie Fett und Kursiv. 
// Zur Umwandlung in Raw-Text wird das npm Modul html-to-text eingebunden
const htmlToText = require("html-to-text");

const cron = require("node-cron");


// @ts-ignore // Circuit SDK - keine  @types vorhanden
const Circuit = require("circuit-sdk");




//*********************************************************************
//* globale Variablen 
//*********************************************************************

let listenersOK = false; // Flag, um zu testen, ob ein der Listener ein "Connecting" liefert (Indikator dafür, dass die Listners gesetzt wurden)
let initMyVarsOK = false; // Flag, ob die Initialisierung durchgelaufen ist

/** @type {object} */
const myConversations = {};

/** @type {object} */
const myUsers = {};
// myUsers.userId = {};

/** @type {Array.<object>} */
let myUsersList = []; // Array mit der userId aller bekannten Anwendern

/** @type {object} */
const myUsersConversations = {}; // Objekt mit den userIds und den Converationen als Array je userId

/** @type {Array.<object>} */
let myUsersPresence = [];

let standardConvIdValid = false;
let standardConvId = "";
const standardContent = {
    parentId: "",
    content: "kein Inhalt"
};


let infoBotEmail = "";


//*********************************************************************
//* globale Funktionen
//*********************************************************************

/** @param {string} key @param {string} value @return {string} entschlüsseltes Passwort */
function decrypt(key, value) {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    adapter.log.debug("client_secret decrypt ready");
    return result;
}

function dateEpochNow() {
    const now = new Date();
    return Date.parse(now.toString());  // aktuelle Zeit in epoch
}

/** @param {Date} epoche - Datum im Format Epoche @return gibt einen String in der Form yyyy-mm-dd hh:mm zurück */
function datumFomatieren(epoche) {
    const date     = new Date(epoche),
        year     = date.getFullYear().toString();
    let month    = (date.getMonth() + 1).toString(),
        day      = date.getDate().toString(),
        hour     = date.getHours().toString(),
        minute   = date.getMinutes().toString(),
        second   = date.getSeconds().toString();
    if (month.length == 1) {
        month  = "0" + month;
    }
    if (day.length == 1) {
        day = "0" + day;
    }
    if (hour.length == 1) {
        hour = "0" + hour;
    }
    if (minute.length == 1) {
        minute = "0" + minute;
    }
    if (second.length == 1) {
        second = "0" + second;
    }
    return year + "-" + month + "-" + day + " " + hour + ":" + minute;
}



//*********************************************************************
//* Create the Adapter
//*********************************************************************


// Create the adapter and define its methods
const adapter = utils.adapter({
    name: "circuit",



    // The ready callback is called when databases are connected and adapter received configuration.
    // start here!
    ready: onReady, // Main method defined below for readability

    // is called when adapter shuts down - callback has to be called under any circumstances!

    unload: (callback) => {
        try {
            adapter.log.info("cleaned everything up...");
            adapter.setState("info.connection", false, true);
            adapter.setState("info.adapter.lastStop", datumFomatieren(new Date(dateEpochNow())) + " - Stopp des Adapters", true);
            circuitBot.logout();
            callback();
        } catch (e) {
            adapter.log.error("Fehler beim Adapter Unload. " + e);
            callback();
        }
    },

    // is called if a subscribed object changes

    objectChange: (id, obj) => {
        if (obj) {
            // The object was changed
            adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            adapter.log.info(`object ${id} deleted`);
        }
    },

    // is called if a subscribed state changes

    stateChange: (id, state) => {
        if (state && !state.ack) {
        // if (state) {
            // The state was changed
            adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            stateChange (id, state);
        } 
        if (!state) {
            // The state was deleted
            adapter.log.info(`state ${id} deleted`);
        }
    },

    useFormatDate: false, // optional - if adapter wants format date according to global settings.
    // if true (some libs must be preloaded) adapter can use "formatDate" function. (adapter.dateFormat)

    // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
    // requires "common.message" property to be set to true in io-package.json
    message: (obj) => {
        if (!obj || !obj.command) return;
        adapter.log.debug("sendTo() message Objekt empfangen: " + JSON.stringify(obj));

        if (typeof obj === "object" && obj.message) {
            if (obj.command === "send") {
                // e.g. send email or pushover or whatever
                const objMessage = (typeof obj.message === obj.message) ? JSON.stringify(obj.message) : obj.message;
                adapter.log.info("sendTo() send command: " + objMessage + " - from: " + obj.from);
                // Send response in callback if required
                // if (obj.callback) adapter.sendTo(obj.from, obj.command, "Message received", obj.callback);
                circuitBot.messageHelper(obj);
            }
        }
    }
});

// macht das Sinn? Bei SIGINT steht adapter.log wahrtscheinlich nicht mehr zur Verfügung.
process.on("SIGINT", function(err) {
    console.log("SIGINT");
    if (adapter && adapter.log) {
        adapter.log.warn("SIGINT: " + err);
        adapter.setState("info.connection", false, true);
    }

});

process.on("uncaughtException", function(err) {
    console.log("Exception: " + err + "/" + err.toString());
    if (adapter && adapter.log) {
        adapter.log.warn("Exception: " + err);
        adapter.setState("info.connection", false, true);
    }
});



//*********************************************************************
//* globale Funktionen - Anfrage in Datenpunkt => Antwort im Datenpunkt
//*********************************************************************

/** @param {string} id  @param {object} state */
function stateChange(id, state) {
    id = id.substring(adapter.namespace.length+1,id.length);
    if(id === "abfragen.getUserById") {
        circuitBot.getUserById(state.val)
            .then((user) => {
                adapter.log.debug("DP getUserById abgefragt: " + state.val);
                adapter.log.debug("DP getUserById Ergebnis: " + JSON.stringify(user));
                adapter.setState("abfragen.getUserByIdAnswer", { val: JSON.stringify(user), ack: true });
            })
            .catch((error) => {
                adapter.log.info("DP getUserById abgefragt: ungültiger User: "+ error);
                adapter.setState("abfragen.getUserByIdAnswer", { val: "ungültige/unbekannte UserID: "+ error, ack: true });
            });
        return;
    }

    if(id === "abfragen.getUserByEmail") {
        circuitBot.getUserByEmail(state.val)
            .then(user => {
                adapter.log.debug("DP getUserByEmail abgefragt: " + state.val);
                adapter.log.debug("DP getUserByEmail Ergebnis: " + JSON.stringify(user));
                adapter.setState("abfragen.getUserByEmailAnswer", { val: JSON.stringify(user), ack: true });
            })
            .catch(error => {
                adapter.log.info("DP getUserByEmail abgefragt: ungültige oder unbekannte Email: "+ error);
                adapter.setState("abfragen.getUserByEmailAnswer", { val: "ungültige/unbekannte Email: "+ error, ack: true });
            });
        return;
    }

    if(id === "abfragen.getConversationParticipants") {
        circuitBot.getConversationParticipants(state.val)
            .then(/** @param {object} res*/res => {
                adapter.log.debug("DP getConversationParticipants abgefragt: " + state.val);
                adapter.log.debug("DP getConversationParticipants Ergebnis: " + JSON.stringify(res));
                adapter.setState("abfragen.getConversationParticipantsAnswer", { val: JSON.stringify(res), ack: true });
            })
            .catch(/** @param {object} error*/error => {
                adapter.log.info("DP getConversationParticipants abgefragt: ungültige oder unbekannte convId: "+ error);
                adapter.setState("abfragen.getConversationParticipantsAnswer", { val: "ungültige/unbekannte convId: "+ error, ack: true });
            });
        return;
    }
    
    if(id === "abfragen.getConversationById") {
        circuitBot.getConversationById(state.val)
            .then(/** @param {object} res*/res => {
                adapter.log.debug("DP getConversationById abgefragt: " + state.val);
                adapter.log.debug("DP getConversationById Ergebnis: " + JSON.stringify(res));
                adapter.setState("abfragen.getConversationByIdAnswer", { val: JSON.stringify(res), ack: true });
            })
            .catch(/** @param {object} error*/error => {
                adapter.log.info("DP getConversationById abgefragt: ungültige oder unbekannte convId: "+ error);
                adapter.setState("abfragen.getConversationByIdAnswer", { val: "ungültige/unbekannte convId: "+ error, ack: true });
            });
        return;
    }

    if(id === "abfragen.getItemById") {
        circuitBot.getItemById(state.val)
            .then(item => {
                adapter.log.debug("DP getItemById abgefragt: " + state.val);
                adapter.log.debug("DP getItemById Ergebnis: " + JSON.stringify(item));
                adapter.setState("abfragen.getItemByIdAnswer", { val: JSON.stringify(item), ack: true });
            })
            .catch(error => {
                adapter.log.info("DP getItemById abgefragt: "+ error.message);
                adapter.setState("abfragen.getItemByIdAnswer", { val: "Error: "+ error.message, ack: true });
            });
        return;
    }


    if(id === "commands.removeParticipant") {
        const command = state.val.replace(/"+|\[+|\]+/gm,"");
        const commandArr = command.split(",");
        const userIds = [];
        for (let index = 1; index < commandArr.length; index++) {
            userIds.push(commandArr[index].trim());
        }
        const convId = commandArr[0].trim();
        circuitBot.removeParticipant(convId,userIds)
            .then(answer => {
                adapter.log.debug(answer);
                adapter.setState("commands.removeParticipantAnswer", {val: answer, ack: true });
            })
            .catch(error => {
                adapter.log.warn("removeParticipant: Error: "+ error);
                adapter.setState("commands.removeParticipantAnswer", {val: error, ack: true });
            });
        return;
    }

    if(id === "_sendToStandardConversation") {
        adapter.log.debug("Command über Datenpunkt _sendToStandardConversation erkannt. Content: " + state.val);
        if(!standardConvIdValid) {
            const text = "Es ist keine gültige Standardkonversation in den Einstellungen konfiguriert. Nachricht kann nicht gesendet werden.";
            adapter.log.warn(text);
            adapter.setState("_sendToStandardConversationAnswer", {val: text, ack: true });
            return;
        }
        standardContent.content = state.val; // den Text im StandardContent (mit der gewünschten parentId) gegen state.val des Datenpunktsaustauschen
        adapter.log.debug("_sendToStandardConversation, addTextItem() mit standardConvId: " + standardConvId + ", Standard Content: " + JSON.stringify(standardContent));
        circuitBot.addTextItem(standardConvId,standardContent)
            .then(answer => {
                const answerText = JSON.stringify(answer);
                adapter.log.debug(answerText);
                adapter.setState("_sendToStandardConversationAnswer",  answerText, true);
            })
            .catch(error => {
                const errorText = JSON.stringify(error);
                adapter.log.warn("_sendToStandardConversation: Error: "+ errorText);
                adapter.setState("_sendToStandardConversationAnswer", errorText, true);
            });
        return;
    }


    
    adapter.log.warn("stateChange, keine Regel für den geänderten Datenpunkt " + id) + "gefunden";
}





//*********************************************************************
//* CircuitBot [APP]
//*********************************************************************

/** @class */
const CircuitBot = function(){
    
    const self = this;
    
    /** @type {object} */
    let client = null;



    //*********************************************************************
    //* logon
    //*********************************************************************
    this.logon = function logon(){
        adapter.log.info("[APP]: Start logon Vorgang");
        return new Promise( function (resolve, reject) {
            adapter.log.info("[APP]: createClient");
            client = new Circuit.Client({
                client_id: adapter.config.client_id,
                client_secret: adapter.config.client_secret,
                domain: adapter.config.circuit_domain,
                autoRenewToken: true
            });

            // self.addEventListeners(client);  //register evt listeners
            self.addEventListeners(client);  //register evt listeners
            adapter.log.info("addEventListeners(client) ausgeführt. Events werden verarbeitet.");
            client.logon()
                .then(/** @param {object} user */ function loggedOn(user) {
                    //adapter.log.debug("[APP]: Authenticated as " + user.displayName)
                    adapter.log.info("[APP]: <"+ user.displayName +"> loggedOn " + JSON.stringify(user));
                    adapter.setState("info.bot.logonJson", JSON.stringify(user),true);
                    adapter.setState("info.bot.name", user.displayName,true);
                    adapter.setState("info.bot.emailAddress", user.emailAddress,true);
                    infoBotEmail = user.emailAddress;
                    adapter.setState("info.circuit.apiVersion", user.apiVersion,true);
                    adapter.setState("info.bot.userId", user.userId,true);
                    adapter.setState("info.bot.accountId", user.accounts[0].accountId,true);
                    adapter.setState("info.bot.tenantId", user.accounts[0].tenantId,true);
                    adapter.setState("info.bot.clientId", user.clientId,true);
                    adapter.setState("info.bot.lastAccess", user.accounts[0].lastAccess,true);
                    adapter.setState("info.bot.creationTime", user.accounts[0].creationTime,true);
                    adapter.setState("info.bot.lastAccessTxt", datumFomatieren(user.accounts[0].lastAccess),true);
                    adapter.setState("info.bot.creationTimeTxt", datumFomatieren(user.accounts[0].creationTime),true);
                    listenersOK = false; // Test-Flag wieder auf false gesetzt, wg. Reconnect Überwachung (TODO prüfen, ob es so Sinn macht)


                    return;

                })
                .then(() => {
                    //adapter.log.info("[APP]: Presence updated to AVAILABLE");
                    adapter.log.debug("[APP]: Logon ready");
                    self.initDp();

                    resolve();
                })
                .catch(reject);
        });
    };

    
    //*********************************************************************
    //* vorhandene Informationen in Datenpunkte ablegen und verarbeiten
    //*********************************************************************

    this.initDp = async function initDp() {

        try {
            adapter.log.debug("[APP]: initDp() vorhandene Konversationen mit dem Bot abfragen");

            const conversations = await self.getConversations({numberOfConversations: 100, numberOfParticipants: 100});
            adapter.log.debug("Anzahl Konversationen mit dem Bot: " + conversations.length);

            testStandardConvId(adapter.config.standardconversation);
            await self.dpCconversations(conversations,true);
            await self.dpMyUsersPresence(); // myPresence schreiben -> aktueller Präsenz ALLER User (in myPresence und dem DP)
            await self.dpUsers(myUsers);


            // Events für Präsenzänderungen hörten nach Zeit auf
            // Lösungsweg corn.schedule
            // Testen, ob renewSessionToken() UND subscribePresence(myUsersList) notwendig sind
            // ider ob eins von beiden ausreicht
            cron.schedule("0 * * * *", function() {
                client.renewSessionToken()
                    .then(() => {
                        adapter.log.debug("Session token renewed");
                        self.subscribePresence(myUsersList); // aktuelle Präsenz aller User (myUsersList) über die API abonieren
                    });
            });


            
        } catch(err) {
            adapter.log.warn("initDp(): " + err);    

        }
    };

    
    //---------------------------------------------------------------------
    //- testConvId (Standard confId testen)
    //---------------------------------------------------------------------


    /** @param {string|undefined} testStr String, der geprüft wir, ob ein gültiges Format für eine ConvID oder eine URL mit ConvId vorliegt. */
    function testConvId(testStr) {
        if(!testStr) {
            return ["error","error"];
        }
        const matchArr = testStr.match(/[a-zA-Z\d]{8}-[a-zA-Z\d]{4}-[a-zA-Z\d]{4}-[a-zA-Z\d]{4}-[a-zA-Z\d]{12}/g);
        if(!matchArr || matchArr.length < 1 ) {
            return ["error","error"];
        } 
        if(matchArr.length === 1 ) matchArr[1] = "error";
        return matchArr;
    }

    function writeInfoNoValidConvId() {
        adapter.log.info("Keine gültige Standard-ConvId gefunden");
        adapter.setState("_sendToStandardConversationAnswer","Keine gültige Standard-ConvId gefunden",true);
    }


    /** @param {string|undefined} testStr String, der geprüft wir, ob ein gültiges Format für eine ConvID oder eine URL mit ConvId vorliegt. */
    async function testStandardConvId (testStr) {
        const stdConvIdArr = testConvId(testStr);
        if(stdConvIdArr[0] === "error") {
            writeInfoNoValidConvId();
            return;
        }
        adapter.log.debug("stdConvIdArr[1]: " + stdConvIdArr[1]);

        standardConvIdValid = true;
        if(stdConvIdArr[1] === "undefined" || typeof stdConvIdArr[1] === "undefined") adapter.log.warn("itemId für Stanardkonversation ist undefinied");
        
        let itemIdText = "";

        if(stdConvIdArr[1] !== "error") {

            await client.getItemById(stdConvIdArr[1])
                .then(/** @param {object} item*/item => {
                    adapter.log.debug("testStandardConvId: getItemById() item: "+ JSON.stringify(item));
                    if(item && item.parentItemId) {
                        standardContent.parentId = item.parentItemId;
                        itemIdText = " itemId: " + item.parentItemId; 
                        adapter.log.info("Standardkonversation, itemId wurde gegen die parentId ausgetauscht: " + item.parentItemId);
                    } else {
                        adapter.log.info("Standardkonversation, itemId ist die parentId des Themas: " + stdConvIdArr[1]);
                        standardContent.parentId = stdConvIdArr[1]; 
                        itemIdText = " itemId: " + stdConvIdArr[1];
                    }
                    // standardContent.parentId = stdConvIdArr[1]
                    // itemIdText = " itemId: " + ???
                })
                .catch(/** @param {object} error*/error => {
                    adapter.log.debug("testStandardConvId, getItemById() " + error.message);
                });

        } else {
            adapter.log.info("Standardkonversation, keine itemId definiert. Nachricht ist immer eine einzelne Nachricht in der Konversation.");
            delete standardContent.parentId;
        }

        // const itemIdText = (stdConvIdArr[1] !== "error") ? " itemId: " + stdConvIdArr[1] : "";
        // TODO: itemId muss die echte parentId des Themas sein. Abfarge mit getItemById möglich? dann Austausch itemId gegen parentId
        // (stdConvIdArr[1] !== "error") ? standardContent.parentId = stdConvIdArr[1] : delete standardContent.parentId;
        standardConvId = stdConvIdArr[0];
        adapter.log.debug("standardContent: "+JSON.stringify(standardContent));
        adapter.log.info("standardConvId: " + standardConvId);
        adapter.log.debug("standardConvIdValid:" + standardConvIdValid);

        adapter.setState("_sendToStandardConversationAnswer","Standardkonversation: " + standardConvId + itemIdText,true );
    }



    //---------------------------------------------------------------------
    //- vorhandene Konversationen in Datenpunkte ablegen und verarbeiten
    //---------------------------------------------------------------------

    /** @param {object} conversations Objekt mit den zu verarbeitenden Konversationen @param {boolean=} all (optional) true, wenn conversations alle Konversationen enthält*/
    this.dpCconversations = async function dpCconversations(conversations,all) {
        try {
            const myUsersOld = myUsers;
            const myConversationsOld = myConversations;
            let anzKonv = 0;
            let anzKonvDirect = 0;
            let anzKonvCommunity = 0;
            let anzKonvGroup = 0;
            let anzKonvExterne = 0;

            for (const conversation of conversations) {
                anzKonv++;
                if (conversation.type === "DIRECT") anzKonvDirect++;
                if (conversation.type === "GROUP") anzKonvGroup++;
                if (conversation.type === "COMMUNITY") anzKonvCommunity++;

                adapter.log.debug(conversation.type + " convId: " + conversation.convId + " topic: " + conversation.topic);
                myConversations[conversation.convId] = conversation;
                const objName = "konversationen." + conversation.type + "." + conversation.convId;
                const state = JSON.stringify(conversation);
                const name = "Infos zur Konversation als JSON";
                let convTopic = conversation.topic;
                let extStr = "";
                let anzTln = 0;         // Zähler Teilnehmer in den Konversationen
                let anzTlnAktiv = 0;    // Zähler aktive Teilnehmer in den Konversationen
                let anzExtUser = 0;     // Zähler externe Teilnehmer in den Konversationen
                const userNamen = [];
                const userNamenInaktiv = [];

                for (const userId of conversation.participants) {
                    if((userId !== client.loggedOnUser.userId)) {
                        anzTln++;
                        const userObj = (myUsers[userId]) ? myUsers[userId] : await this.getUserById(userId);
                        if(!myUsersConversations[userId]) myUsersConversations[userId] = [];
                        if(myUsersConversations[userId].indexOf(conversation.convId) === -1) myUsersConversations[userId].push(conversation.convId);
                        if (conversation.type === "DIRECT") {
                            adapter.log.debug("DIRECT Konversation. Username für Channelbeschriftung ermitteln.");
                            convTopic = userObj.displayName;
                            adapter.log.debug(conversation.convId + " Name für den DIRECT-Cahnnel: " + convTopic);
                        }
                        myUsers[userId] = userObj;
                        if (myUsers[userId].userType === "GUEST") anzExtUser++;
                        if(["SUSPENDED","DELETED","INACTIVE"].indexOf(myUsers[userId].userState) === -1) { // aktive Teilnehmer
                            anzTlnAktiv++;
                            userNamen.push(myUsers[userId].displayName);
                        } else { // inaktive Teilnehmer
                            userNamen.push(myUsers[userId].displayName + " (" + myUsers[userId].userState + ")");
                            userNamenInaktiv.push(myUsers[userId].displayName + " (" + myUsers[userId].userState + ")");
                        }

                    }
                }                
                
                if(anzExtUser > 0) {
                    anzKonvExterne++;
                    extStr = "[EXTERN] ";
                } // ende for: User alle User einer Konversation verarbeiten

                adapter.log.debug("Datenpunkte **konversationen** anlegen: " + conversation.convId);

                adapter.setObject(objName, {type: "channel",common: {name: extStr + convTopic},native: {}});

                adapter.setObjectNotExists(objName+".object", {type: "state",common: {name: name,type:"string",role:"text",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".anzahlTeilnehmerExtern", {type: "state",common: {name: "Anzahl externe Teilnehmer",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".anzahlTeilnehmer", {type: "state",common: {name: "Anzahl Teilnehmer ohne diesen Bot",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".anzahlTeilnehmerAktiv", {type: "state",common: {name: "Anzahl aktiver Teilnehmer ohne diesen Bot",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".userNamen", {type: "state",common: {name: "Displaynamen der Teilnehmer",type:"string",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".userNamenInaktiv", {type: "state",common: {name: "Displaynamen der inaktiven Teilnehmer",type:"string",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists(objName+".url", {type: "state",common: {name: "URL der Konversation",type:"string",role:"info",read:true,write:false},native: {}});

                adapter.setState(objName+".object",state,true);
                adapter.setState(objName+".anzahlTeilnehmerExtern",anzExtUser,true);
                adapter.setState(objName+".anzahlTeilnehmer",anzTln,true);
                adapter.setState(objName+".anzahlTeilnehmerAktiv",anzTlnAktiv,true);
                adapter.setState(objName+".userNamen",JSON.stringify(userNamen),true);
                adapter.setState(objName+".userNamenInaktiv",JSON.stringify(userNamenInaktiv),true);
                adapter.setState(objName+".url","https://" + adapter.config.circuit_domain + "/#/conversation/" + conversation.convId,true);
            }


            if(all) {
                adapter.setObjectNotExists("konversationen.anzahl", {type: "state",common: {name: "Anzahl Konversationen",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists("konversationen.anzahlDirect", {type: "state",common: {name: "Anzahl Konversationen DIRECT",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists("konversationen.anzahlCommunity", {type: "state",common: {name: "Anzahl Konversationen COMMUNITY",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists("konversationen.anzahlGroup", {type: "state",common: {name: "Anzahl Konversationen GROUP",type:"number",role:"info",read:true,write:false},native: {}});
                adapter.setObjectNotExists("konversationen.anzahlMitExternen", {type: "state",common: {name: "Anzahl Konversationen mit Externen",type:"number",role:"info",read:true,write:false},native: {}});
    
                adapter.setState("konversationen.anzahl",anzKonv,true);
                adapter.setState("konversationen.anzahlDirect",anzKonvDirect,true);
                adapter.setState("konversationen.anzahlCommunity",anzKonvCommunity,true);
                adapter.setState("konversationen.anzahlGroup",anzKonvGroup,true);
                adapter.setState("konversationen.anzahlMitExternen",anzKonvExterne,true);
            }
            // if(JSON.stringify(myConversationsOld) !== JSON.stringify(myConversations)) {
            adapter.log.debug("myConversations:" + JSON.stringify(myConversations));
            self.writeDpMyConversations();
            // }
            // if(JSON.stringify(myUsersOld) !== JSON.stringify(myUsers)) {
            adapter.log.debug("myUsers:" + JSON.stringify(myUsers));
            self.writeDpMyUsers();
            // }

            adapter.log.debug("myUsersConversations:" + JSON.stringify(myUsersConversations));
            self.writeDpMyUsersConversations();
            initMyVarsOK = true; // myUsers und myConversations Variablen sind gefüllt

        } catch(err) {
            adapter.log.warn("dpConversations(conversations,all): " + err);    
        }
    };

    //---------------------------------------------------------------------
    //- aktuelle Präsenz ALLER Tln abfragen, DP schreiben, Events abonieren
    //---------------------------------------------------------------------

    /** @function fragt die Presence ALLER User über die API ab, setzt die Subscriptions für Presence und schreibt die globale Variabe myPresence */
    this.dpMyUsersPresence = async function dpMyUsersPresence() {
        try {
            if(!initMyVarsOK) adapter.log.warn("dpMyUsersPresence() myUsers ist noch leer, wird aber benötigt. myUsers: " + JSON.stringify(myUsers));
            if(myUsersList.length > 0) {
                adapter.log.debug("dpMyUsersPresence(): myUsersList: " + myUsersList);
                myUsersPresence = await client.getPresence(myUsersList,true); // aktuelle Präsenz aller User (myUsersList) über die API abfragen (true => erweiterte Präsenz)
                adapter.log.debug("dpMyUsersPresence(): myUsersPresence: " + JSON.stringify(myUsersPresence));
        
                this.subscribePresence(myUsersList); // aktuelle Präsenz aller User (myUsersList) über die API abonieren
        
                adapter.setObjectNotExists("variablen.myUsersPresence", {type: "state",common: {name: "App Variable myUsersPresence",type:"string",role:"info",read:true,write:false},native: {}});
                adapter.setState("variablen.myUsersPresence",JSON.stringify(myUsersPresence),true);
            } else {
                adapter.log.info("Noch keine User in einer Bot Konversation vorhanden (myUsersList.length <1)");
            }
                
        } catch (error) {
            adapter.log.warn("dpMyUsersPresence(): " + error);    
        }

    };    

    //---------------------------------------------------------------------
    //- dpUsers(users) User DP anlegen
    //---------------------------------------------------------------------

    /** @param {object} users - in der Regel das myUsers Objekt, auch ein einzelnes Objekt mit einem User ist möglich*/
    this.dpUsers = function dpUsers(users) {
        adapter.log.info("Datenpunkte **users** anlegen für " + JSON.stringify(users));
        for (const userId in users) {
            const objName = "users." + myUsers[userId].userId;
            const userType = (myUsers[userId].userType == "REGULAR") ? "" : " (" + myUsers[userId].userType + " - " + myUsers[userId].company + ")";
            const userState = (myUsers[userId].userState == "ACTIVE") ? "" : " (" + myUsers[userId].userState + ")";
            const name = myUsers[userId].displayName + userType + userState;

            adapter.log.debug("dpUsers: " + name + ", userId: (" + userId + ")");

            adapter.setObject(objName, {type: "channel",common: {name: name},native: {}});

            adapter.setObjectNotExists(objName+".object", {type: "state",common: {name: "User Objekt",type:"string",role:"text",read:true,write:false},native: {}});
            adapter.setObjectNotExists(objName+".url", {type: "state",common: {name: "Circuit URL zum User",type:"string",role:"text",read:true,write:false},native: {}});
            adapter.setObjectNotExists(objName+".userType", {type: "state",common: {name: "User Typ",type:"string",role:"text",read:true,write:false},native: {}});
            adapter.setObjectNotExists(objName+".userState", {type: "state",common: {name: "User Status",type:"string",role:"text",read:true,write:false},native: {}});
            adapter.setObjectNotExists(objName+".displayName", {type: "state",common: {name: "User Status",type:"string",role:"text",read:true,write:false},native: {}});

            adapter.setState(objName+".object",JSON.stringify(myUsers[userId]),true);
            adapter.setState(objName+".url","https://" + adapter.config.circuit_domain+"/#/email/" + myUsers[userId].emailAddress,true);
            adapter.setState(objName+".userType",myUsers[userId].userType,true);
            adapter.setState(objName+".userState",myUsers[userId].userState,true);
            adapter.setState(objName+".displayName",myUsers[userId].displayName,true);

            self.dpUsersPresence(userId);
        }
    };

    //---------------------------------------------------------------------
    //- dpUsersPresence() User Presence DP beim User anlegen
    //---------------------------------------------------------------------

    /** @function User Presence DP beim User anlegen @param {string} userId*/
    this.dpUsersPresence = function dpUsersPresence(userId) {
        adapter.log.debug("dpUsersPresence(userId) mit userId = " + userId + " aufgerufen");
        const objName = "users." + myUsers[userId].userId;
        adapter.log.debug("dpUsersPresence(userId) objName = " + objName);

        let index = -1;
        for (let i = 0; i < myUsersPresence.length; i++) {
            if (myUsersPresence[i].userId === userId) index = i;
        }

        adapter.log.debug("dpUsersPresence:  myUsersPresence[index]: " +  JSON.stringify(myUsersPresence[index]));
        adapter.log.debug("dpUsersPresence:  myUsersPresence[index].mobile: " +  myUsersPresence[index].mobile);

        const mobileStr = (myUsersPresence[index].mobile) ? " (MOBILE)" : "";
        const nameStr = (myUsersPresence[index].isOptedOut) ? " (PRÄSENZ UNTERDRÜCKT)" : myUsersPresence[index].state + mobileStr;

        adapter.setObject(objName+".presence", {type: "channel",common: {name: nameStr},native: {}});

        adapter.setObjectNotExists(objName+".presence.stateBool", {type: "state",common: {name: "Aktuelle Präsenz als Boolean für Statistik (AVAILABLE + BUSY = true.",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.stateBoolAvailable", {type: "state",common: {name: "Aktuelle Präsenz als Boolean für Statistik ( nur AVAILABLE + (MOBILE) = true",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.stateBoolBUSY", {type: "state",common: {name: "Aktuelle Präsenz als Boolean für Statistik ( nur BUSY = true -> Nutzung)",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.state", {type: "state",common: {name: "Aktuelle Präsenz",type:"string",role:"text",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.stateInclMobile", {type: "state",common: {name: "Aktuelle Präsenz inklusive Mobil",type:"string",role:"text",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.mobile", {type: "state",common: {name: "mobile",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.poor", {type: "state",common: {name: "poor",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.isOptedOut", {type: "state",common: {name: "isOptedOut",type:"boolean",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.object", {type: "state",common: {name: "Präsenzobjekt",type:"string",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.time", {type: "state",common: {name: "Zeitstempel Epoche durch den Adapter geschrieben",type:"number",role:"info",read:true,write:false},native: {}});
        adapter.setObjectNotExists(objName+".presence.timeStr", {type: "state",common: {name: "Zeitstempel lesbar durch den Adapter geschrieben",type:"string",role:"info",read:true,write:false},native: {}});


        // TODO: beim Start des Adapters sind die Werte leer, erst bei Änderung der User Presänz. prüfen warum
        const stateBoolAvailable  = (myUsersPresence[index].state === "AVAILABLE") ? true : false;
        const stateBoolBusy  = (myUsersPresence[index].state === "BUSY") ? true : false;
        const stateBool = (stateBoolAvailable || stateBoolBusy) ? true : false;
        
        adapter.setState(objName+".presence.stateBool",stateBool,true);
        adapter.setState(objName+".presence.stateBoolAvailable",stateBoolAvailable,true);
        adapter.setState(objName+".presence.stateBoolBUSY",stateBoolBusy,true);
        adapter.setState(objName+".presence.state",myUsersPresence[index].state,true);
        adapter.setState(objName+".presence.stateInclMobile",nameStr,true);
        adapter.setState(objName+".presence.mobile",myUsersPresence[index].mobile,true);
        adapter.setState(objName+".presence.poor",myUsersPresence[index].poor,true);
        adapter.setState(objName+".presence.isOptedOut",myUsersPresence[index].isOptedOut,true);
        adapter.setState(objName+".presence.object",JSON.stringify(myUsersPresence[index]),true);
        adapter.setState(objName+".presence.time",dateEpochNow(),true);
        adapter.setState(objName+".presence.timeStr",datumFomatieren(new Date(dateEpochNow())),true);

        // bei state = AVAILBLE gibt es noch den Punkt inTransit (ggf. ergänzen)
        adapter.log.debug("dpUsersPresence() DP gesetzt für User: " + userId + " (" + myUsers[userId].displayName + ")");
    };

    //---------------------------------------------------------------------
    //- myUsers und myConversations in Datenpunkte schreiben
    //---------------------------------------------------------------------

    this.writeDpMyConversations = function writeDpMyConversations() {
        adapter.setObjectNotExists("variablen.myConversations", {type: "state",common: {name: "App Variable myConversations",type:"string",role:"info",read:true,write:false},native: {}});
        adapter.setState("variablen.myConversations",JSON.stringify(myConversations),true);

    };

    this.writeDpMyUsersConversations = function writeDpMyUsersConversations() {
        adapter.setObjectNotExists("variablen.myUsersConversations", {type: "state",common: {name: "App Variable myUsersConversations",type:"string",role:"info",read:true,write:false},native: {}});
        adapter.setState("variablen.myUsersConversations",JSON.stringify(myUsersConversations),true);
        for (const userId in myUsersConversations) {
            adapter.setObjectNotExists("users." + userId + ".conversations", {type: "state",common: {name: "Konversationen des Users mit dem Bot",type:"string",role:"info",read:true,write:false},native: {}});
            adapter.setState("users." + userId + ".conversations",JSON.stringify(myUsersConversations[userId]),true);
        }

    };

    this.writeDpMyUsers = function writeDpMyUsers() {
        adapter.setObjectNotExists("variablen.myUsers", {type: "state",common: {name: "App Variable myUsers",type:"string",role:"info",read:true,write:false},native: {}});
        adapter.setState("variablen.myUsers",JSON.stringify(myUsers),true);

        myUsersList = [];
        for (const user in myUsers) {
            myUsersList.push(user);
        }
        adapter.log.debug("myUsersList: " + JSON.stringify(myUsersList));
        adapter.log.debug("Anzahl der gefundenen User in Bot Konversationen: " + myUsersList.length);

        adapter.setObjectNotExists("variablen.myUsersList", {type: "state",common: {name: "App Variable myUsersList",type:"string",role:"info",read:true,write:false},native: {}});
        adapter.setState("variablen.myUsersList",JSON.stringify(myUsersList),true);
    };


    //---------------------------------------------------------------------
    //- messageHelper für sendTo()
    //---------------------------------------------------------------------


    /** @param {object|string} obj*/
    this.messageHelper = function messageHelper(obj) {
        // nur string als Message => Text wird an die Standardkonversation geschickt
        if(typeof obj.message === "string") {
            if(!standardConvIdValid) {
                const callback = "Error, sendTo(text) keine gültige Standardkonversation in der Konfiguration";
                adapter.log.warn(callback);
                if (obj.callback) adapter.sendTo(obj.from, obj.command, callback, obj.callback);
                return;
            }
            standardContent.content = obj.message; // den Text im StandardContent (mit der gewünschten parentId) gegen den sendTo()) obj.message Text austauschen
            this.addTextItem(standardConvId,standardContent)
                .then(answer => {
                    const answerText = "sendTo(text): from: " + obj.from + ", Message: `" + obj.message + "` an convId: " +  answer.convId + ", itemId: " + answer.itemId +" erfolgreich gesendet.";
                    adapter.log.debug(answerText);
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, answerText, obj.callback);
                })
                .catch((error) => {
                    const errorText = "sendTo(text) from: " + obj.from + ", Error: " + JSON.stringify(error) + " - bei der Nachricht: " + obj.message;
                    adapter.log.warn(errorText);
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, errorText, obj.callback);
                });
            return;
        }

        if(typeof obj.message !== "object") {
            adapter.log.warn("sendTo() obj.message, kein unterstützter Typ:" + typeof obj.message);
            return;
        }

        // TODO: DirektMessage an Teilnehmer mit userId oder Email
        // "direct": {}

        // nur Objekt mit API Aufruf als Message => API Funktion wird aufgerufen
        // "api": {string} name der gewünschten API Funktion
        // "param": {string|object} Parameter in Richtung API
        if(obj && obj.message && obj.message.api) {
            let res = {};
            let infoStr = "";

            switch (obj.message.api) {
                case "getConversationById":
                    if(!obj.message.convId) {
                        res = {"result": null,"error": "getConversationById() Pflichtparameter convId nicht angegeben"};
                        this.messageHelperCallback(obj,res);
                        return;
                    }
                    adapter.log.debug("sendTo() API Aufruf getConversationById() mit dem Parameter convId: " + obj.message.convId);
                    // obj.message.param : {string} convId
                    this.getConversationById(obj.message.convId)
                        .then(result =>{res = {"result": result,"error": null};
                            this.messageHelperCallback(obj,res);
                        })
                        .catch(error => {res = {"result": null,"error": error.message};
                            this.messageHelperCallback(obj,res);
                        });
                    break;

                case "getConversationParticipants":
                    if(!obj.message.convId) {
                        res = {"result": null,"error": "getConversationById() Pflichtparameter convId nicht angegeben"};
                        this.messageHelperCallback(obj,res);
                        return;
                    }
                    (obj.message.options) ? infoStr = " mit der Option options:"+JSON.stringify(obj.message.options) : infoStr = " ohne optionale options";
                    adapter.log.debug("sendTo() API Aufruf getConversationParticipants() mit dem Parameter convId: " + obj.message.convId + infoStr);
                    // obj.message.convId {string} optional: options {object=}
                    this.getConversationParticipants(obj.message.convId,obj.message.options)
                        .then(result =>{res = {"result": result,"error": null};
                            this.messageHelperCallback(obj,res);
                        })
                        .catch(error => {res = {"result": null,"error": error.message};
                            this.messageHelperCallback(obj,res);
                        });
                    break;

                case "getConversations":
                    (obj.message.options) ? infoStr = "mit der Option options: "+JSON.stringify(obj.message.options) : infoStr = "ohne optionale options, d.h. max. 25 Konversationen, max. 8 Teilnehmer je Konversation";
                    adapter.log.debug("sendTo() API Aufruf getConversations() " + infoStr);
                    // optional: options {object=}
                    this.getConversations(obj.message.options)
                        .then(result =>{res = {"result": result,"error": null};
                            this.messageHelperCallback(obj,res);
                        })
                        .catch(error => {res = {"result": null,"error": error.message};
                            this.messageHelperCallback(obj,res);
                        });
                    break;



                default:
                    res = {"result":null,"error":"sendTo() API Schnittstelle, keine gültige API aufgerufen. (" + obj.message.api + ")"};
                    this.messageHelperCallback(obj,res);
                    break;
            }
            return;
        }

        adapter.log.warn("sendTo() kein bekanntes Message Objekt");

    }; // End: this.messageHelper(obj)


    // Logs und Callbackmeldung für sendTo()
    // -------------------------------------
    /** @param {object|string} obj @param {object|string} res */
    this.messageHelperCallback = async function messageHelperCallback(obj,res) {
        adapter.log.debug("sendTo() gesendetes obj: " + JSON.stringify(obj));
        adapter.log.debug("sendTo() empfangen res: " + JSON.stringify(res));
        if(res.error) adapter.log.warn(res.error);
        if (obj.callback) adapter.sendTo(obj.from, obj.command, res, obj.callback);
    };


    //*********************************************************************
    //* logout
    //*********************************************************************
    this.logout = function logout(){
        adapter.log.info("[APP]: logout");
        client.logout();

    };


    //*********************************************************************
    //* addEventListeners
    //*********************************************************************
    
    /** @param {object} client*/
    this.addEventListeners = function addEventListeners(client){
        adapter.log.info("[APP]: addEventListeners");
        //set event callbacks for this client

        Circuit.supportedEvents.forEach(/** @param {string} e*/e => client.addEventListener(e, self.logEvent));

        client.addEventListener("connectionStateChanged", /** @param {object} evt */ function (evt) {
            adapter.setState("info.lastConnectionState", evt.state,true);
            // self.logEvent(evt);
            if(evt.state === "Connected") {
                adapter.setState("info.connection", true, true);
                adapter.log.debug("Adapterfarbe: grün");
                client.setPresence({state: Circuit.Enums.PresenceState.AVAILABLE});
                adapter.log.info("[APP]: Presence updated to AVAILABLE");
            } else {
                adapter.setState("info.connection", false, true);
                adapter.log.debug("Adapterfarbe: gelb");
            }
            // Testen, ob der Listener gesetzt wurde, anhand der Kontrolle, ob ein Connecting empfangen wurde
            if(evt.state === "Connecting") listenersOK = true;
        });

        client.addEventListener("registrationStateChanged", /** @param {object} evt */ function (evt) {
            // self.logEvent(evt);
        });

        client.addEventListener("userPresenceChanged", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            self.eventUserPresenceChanged(evt);
        });

        // eslint-disable-next-line no-unused-vars
        client.addEventListener("reconnectFailed", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            adapter.setState("info.lastReconnectFailed", datumFomatieren(new Date(dateEpochNow())),true);
        });

        // neuer Eintrag in einer Konversation
        client.addEventListener("itemAdded", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            self.reciveItem(evt);
        });
        // Eintrag in einer Konversation wurde bearbeitet
        client.addEventListener("itemUpdated", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            self.reciveItem(evt);
        });

        // Konversation hat neue Parameter
        client.addEventListener("conversationUpdated", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            self.eventConversationUpdated(evt);
        });

        // Konversation mit dem Bot wurde erstellt
        client.addEventListener("conversationCreated", /** @param {object} evt */ function (evt) {
            //self.logEvent(evt);
            self.eventConversationCreated(evt);
        });


        /* mögliche Events:

        accessTokenRenewed
        renewAccessTokenFailed
        loggedOnUserUpdated
        itemAdded                       (verwendet)
        itemUpdated                     (verwendet)
        itemFlagged
        itemUnflagged
        conversationCreated             (verwendet)
        conversationUpdated             (verwendet)
        conversationArchived
        conversationFavorited
        conversationUnarchived
        conversationUnfavorited
        conversationUserDataChanged
        conversationReadItems
        userPresenceChanged             (verwendet)
        userUpdated                                -> TODO: erst myUsers aktualisieren, dann this.dpUsers
        connectionStateChanged          (verwendet)
        sessionTokenRenewed
        reconnectFailed
        userSettingsChanged
        basicSearchResults
        systemMaintenance
        whiteboardEnabled
        whiteboardElement
        whiteboardCleared
        mention
        formSubmission
        callIncoming
        callStatus
        callNetworkQualityChanged
        callRtpThresholdReached
        callRtpThresholdCleared
        callEnded
        whiteboardBackground
        whiteboardOverlayToggled
        whiteboardSync
        labelsAdded
        labelEdited
        labelsRemoved
        typing
*/

    };


    //*********************************************************************
    //* userPresenceChanged
    //*********************************************************************
    /** @param {object} evt */
    this.eventUserPresenceChanged = function eventUserPresenceChanged(evt){
        const userId = evt.presenceState.userId;
        const displayName = myUsers[userId].displayName;
        // adapter.log.info("[APP]: event received: " + displayName + " " + util.inspect(evt, { showHidden: true, depth: null }));	
        adapter.log.info("[APP]: event received: " + displayName + " " + JSON.stringify(evt));
        
        let index = -1;
        for (let i = 0; i < myUsersPresence.length; i++) {
            if (myUsersPresence[i].userId === userId) index = i;
        }

        adapter.log.debug("myUsersPresence index: " + index + " - alter Wert: "+ JSON.stringify(myUsersPresence[index]));
        adapter.log.debug("myUsersPresence index: " + index + " - neuer Wert: " + JSON.stringify(evt.presenceState));
        myUsersPresence[index] = evt.presenceState; // neuer Präsenzstatus für den User austauschen
        adapter.setState("variablen.myUsersPresence",JSON.stringify(myUsersPresence),true); // DP für myUsersPresence schreiben
        self.dpUsersPresence(userId); // Präsenzstaus in den Datenpunkt des Users schreiben
    };

    
    //*********************************************************************
    //* eventConversationUpdated
    //*********************************************************************

    /** @param {object} evt */
    this.eventConversationUpdated = async function eventConversationUpdated(evt) {
        // TODO Events ausfiltern, z.B. PARTICIPANT_REMOVED
        
        // adapter.log.warn("eventConversationUpdated() event empfangen.");

        // if(evt.conversation.topLevelItem.system.type === "PARTICIPANT_REMOVED") {
        //     adapter.log.warn("eventConversationUpdated() PARTICIPANT_REMOVED wird nicht verarbeitet");
        //     return;
        // }

        adapter.log.debug("eventConversationUpdated() wird verarbeitet");

        // const conversation = await this.getConversationById(evt.conversation.convId);
        // this.dpCconversations([conversation]);

        // Umbau gegen die beiden auskommentierten Zeilen dadrüber. Testen.
        this.getConversationById(evt.conversation.convId)
            .then(/** @param {object} conversation*/conversation => {
                this.dpCconversations([conversation]);
            })
            .catch(/** @param {string} error*/error => {
                adapter.log.debug("eventConversationUpdated " + (error));
            });
        
        return;

    };


   
    //*********************************************************************
    //* eventConversationCreated
    //*********************************************************************

    /** @param {object} evt */
    this.eventConversationCreated = async function eventConversationCreated(evt) {
        adapter.log.info("eventConversationCreated() wird verarbeitet");

        this.getConversationById(evt.conversation.convId)
            .then(/** @param {object} conversation*/conversation => {
                this.dpCconversations([conversation]);
            })
            .catch(/** @param {object} error*/error => {
                adapter.log.debug("eventConversationCreated " + (error.message));
            });
        
        return;

    };


    //*********************************************************************
    //* particiapantRemoved (nach event itemAdded)
    //*********************************************************************

    /** @param {object} evt */
    this.particiapantRemoved = async function particiapantRemoved(evt) {
        // adapter.log.info("PARTICIPANT_REMOVED");
        const convId = evt.item.convId;
        evt.item.system.affectedParticipants.forEach(/** @param {string} userId */userId => {
            adapter.log.info("PARTICIPANT_REMOVED: " + userId + " aus convId: " + convId);
            //myUsersConversations bereinigen
            adapter.log.debug("vorher: " + JSON.stringify(myUsersConversations));
            myUsersConversations[userId] = myUsersConversations[userId].filter(/** @param {string} item */ item => item !== convId); // löscht element nach Wert aus dem Array
            adapter.log.debug("nachher: " + JSON.stringify(myUsersConversations));
            
            //myUsers bereinigen, wenn User in keiner Konversation mehr
            if(myUsersConversations[userId].length === 0) {

                // Channelname des Users kennzeichen
                const userState = (myUsers[userId].userState == "ACTIVE") ? "" : " (" + myUsers[userId].userState + ")";
                const userType = (myUsers[userId].userType == "REGULAR") ? "" : " (" + myUsers[userId].userType + " - " + myUsers[userId].company + ")";
                const name = "[Keine Botkonversation mehr] " + myUsers[userId].displayName + userType + userState;
                const objName = "users." + myUsers[userId].userId;
                adapter.log.warn("objName: " + objName);
                adapter.log.warn("name: " + name);
                adapter.setObject(objName, {type: "channel",common: {name: name},native: {}});

                adapter.log.warn("User: " + userId + " wird aus myUsers gelöscht");
                delete myUsers[userId]; // löscht element aus Objekt
                adapter.log.warn("User: " + userId + " aus myUsers gelöscht");

                // delete myUsersConversations[userId]; // löscht element aus Objekt (TODO: Entscheidung ja oder nein.)
            }


        });

        // TODO ansehen, ob nötig und in welchem Umfang => self.dpUsers(myUsers);
        // const conversation = await this.getConversationById(convId);
        // this.dpCconversations([conversation]);

        // Umbau gegen die beiden auskommentierten Zeilen dadrüber. Testen.
        await this.getConversationById(convId)
            .then(/** @param {object} conversation*/conversation => {
                this.dpCconversations([conversation]);
            })
            .catch(/** @param {string} error*/error => {
                adapter.log.debug("particiapantRemoved " + (error));
            });



        await self.writeDpMyUsersConversations();
        await self.writeDpMyConversations();
        await self.writeDpMyUsers();
        // todo: myUsersPresence prüfen
        
    };

    //*********************************************************************
    //* logEvent -- helper
    //*********************************************************************
    /** @param {object} evt */
    this.logEvent = function logEvent(evt){
        
        // TODO Routine, die die Events sammelt und diese abarbeitet, sollten Events vor dem Anlegen der myVariablen komemn
        if(!initMyVarsOK && evt.type !== "connectionStateChanged") adapter.log.warn("EVENT empfangen, bevor alle myVariablen angelegt wurden");
        
        adapter.setState("info.lastEventType", evt.type, true);
        adapter.setState("info.lastEvent", JSON.stringify(evt), true);
        //adapter.log.debug("[APP]: " + evt.type + " event received");
        if(evt.type === "connectionStateChanged") {
            // adapter.log.info("[APP]: event received: " + util.inspect(evt, { showHidden: true, depth: null }));
            adapter.log.info("[APP]: event received: " + JSON.stringify(evt));
        } else {
            // adapter.log.debug("[APP]: event received: " + util.inspect(evt, { showHidden: true, depth: null }));
            adapter.log.debug("[APP]: event received: " + JSON.stringify(evt));
        }
    };

    //*********************************************************************
    //* sentByMe -- helper
    //*********************************************************************
    /** @param {object} item */
    this.sentByMe = function sentByMe (item){
        if(client.loggedOnUser.userId === item.creatorId) {
            adapter.log.debug("[APP]: sentByMe(): eigenes item erkannt");
        } else {
            adapter.log.debug("[APP]: sentByMe(): fremdes item erkannt");
        }
        return (client.loggedOnUser.userId === item.creatorId);
    };

    //*********************************************************************
    //* subscribePresence
    //*********************************************************************
    /** @param {Array.<string>} userIds */    
    this.subscribePresence = function subscribePresence(userIds) {
        return new Promise ((resolve, reject) => {
            client.subscribePresence(userIds)
                .then(() => {
                    adapter.log.debug("subscribePresence() Successfully subscribed");
                    resolve("subscribePresence() Successfully subscribed");
                })
                .catch(/** @param {object} error*/error => {
                    adapter.log.debug("subscribePresence() " + error.message);
                    reject(new Error("subscribePresence() " + error.message));
                });
        });
    };

        
    //*********************************************************************
    //* getUserById - UserID -> gibt das User Objekt zurück
    //*********************************************************************
    /** @param {string} userId */    
    this.getUserById = function getUserById(userId) {
        // adapter.log.debug("[APP]: getUserById() mit UserID "+ userId + " aufgerufen");
        return new Promise ((resolve, reject) => {
            client.getUserById(userId)
                .then(/** @param {object} user*/user => {
                    adapter.log.debug("[APP]: getUserById() User: "+ JSON.stringify(user));
                    resolve(user);
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.debug("getUserById() " + error);
                    reject(new Error("getUserById() " + error));
                });
        });
    };


    
    //*********************************************************************
    //* getConversationById
    //*********************************************************************

    /** @param {string} convId*/
    this.getConversationById = function getConversationById(convId) {
        const resArr = testConvId(convId);
        convId = (resArr[0] !== "error") ? resArr[0] : convId;
        adapter.log.debug("[APP]: getConversationById() mit convId "+ convId + " aufgerufen");
        return new Promise ((resolve, reject) => {
            client.getConversationById(convId)
                .then(/** @param {object} conversation*/conversation => {
                    adapter.log.debug("[APP]: getConversationById() res: "+ JSON.stringify(conversation));
                    resolve(conversation);
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.debug("getConversationById('"+ convId + "') " + (error));
                    reject(new Error("getConversationById('"+ convId + "') " + error));
                });
        });
    };


    //*********************************************************************
    //* getConversationParticipants
    //*********************************************************************

    // SDK Doku: https://circuitsandbox.net/sdk/classes/Client.html#method_getConversationParticipants

    /** @param {string} convId @param {object=} options */
    this.getConversationParticipants = function getConversationParticipants(convId, options) {
        const resArr = testConvId(convId);
        convId = (resArr[0] !== "error") ? resArr[0] : convId;
        adapter.log.debug("[APP]: getConversationParticipants() mit convId "+ convId + " aufgerufen");
        return new Promise ((resolve, reject) => {
            client.getConversationParticipants(convId, options)
                .then(/** @param {object} res*/res => {
                    adapter.log.debug("[APP]: getConversationParticipants() res: "+ JSON.stringify(res));
                    resolve(res);
                })
                .catch(/** @param {object} error*/error => {
                    adapter.log.debug("getConversationParticipants() " + error);
                    reject(new Error("getConversationParticipants() "  + error));
                });
        });
    };

    
    //*********************************************************************
    //* getConversations
    //*********************************************************************
    /** @param {object} options */
    this.getConversations = function getConversations (options) {
        adapter.log.debug("[APP]: getConversations() aufgerufen");
        return new Promise ((resolve, reject) => {
            client.getConversations(options)
                .then(/** @param {object} conversations*/conversations => {
                    adapter.log.debug("[APP]: getConversations() conversations: "+ JSON.stringify(conversations));
                    resolve(conversations);
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.warn("getConversations() " + error);
                    reject(new Error("getConversations() " + error));
                });
        });
    };


    //*********************************************************************
    //* getUserByEmail - UserID -> gibt das User Objekt zurück
    //*********************************************************************

    /** @param {string} email */
    this.getUserByEmail = function getUserByEmail(email) {
        // adapter.log.debug("[APP]: getUserByEmail() mit Email "+ email + " aufgerufen");
        return new Promise ((resolve, reject) => {
            client.getUserByEmail(email)
                .then(/** @param {object} user*/user => {
                    adapter.log.debug("[APP]: getUserByEmail() user: "+ JSON.stringify(user));
                    resolve(user);
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.debug("getUserByEmail() " + error);
                    reject(new Error("getUserByEmail() " + error));
                });
        });
    };


    //*********************************************************************
    //* getItemById
    //*********************************************************************

    /** @param {string} itemId */
    this.getItemById = function getItemById(itemId) {
        return new Promise ((resolve, reject) => {
            client.getItemById(itemId)
                .then(/** @param {object} item*/item => {
                    adapter.log.debug("[APP]: getItemById() item: "+ JSON.stringify(item));
                    resolve(item);
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.debug("getItemById() " + error);
                    reject(new Error("getItemById() " + error));
                });
        });
    };


    
    //*********************************************************************
    //* removeParticipant
    //*********************************************************************

    // https://circuitsandbox.net/sdk/classes/Client.html#method_removeParticipant
    // Required OAuth2 scopes: WRITE_CONVERSATIONS, MANAGE_CONVERSATIONS, or ALL

    /** @param {string} convId @param {string|Array.<string>} userIds */
    this.removeParticipant = function removeParticipant(convId,userIds) {
        adapter.log.debug("[APP]: removeParticipant() mit convId " + convId + " & userIds:" + JSON.stringify(userIds) + " aufgerufen");
        return new Promise ((resolve, reject) => {
            client.removeParticipant(convId, userIds)
                .then(() => {
                    adapter.log.debug("[APP]: removeParticipant() userIds:" + JSON.stringify(userIds) + " - erfolgreich aus convId:" + convId + " entfernt");
                    resolve("[APP]: removeParticipant() userIds:" + JSON.stringify(userIds) + " - erfolgreich aus convId:"  + convId + " entfernt");
                })
                .catch(/** @param {string} error*/error => {
                    adapter.log.debug("client.removeParticipant() " + error);
                    reject(new Error("client.removeParticipant() " + error));
                });
        });
    };



    //*********************************************************************
    //* addTextItem (Nachricht senden)
    //*********************************************************************

    // https://circuitsandbox.net/sdk/classes/Client.html#method_addTextItem

    /** @param {string} convId - string mit der ID der Konversation @param {object|string} message - object mit (convId, parentId, content) oder string mit dem Inhalt, der gesendet werden soll */
    this.addTextItem = function addTextItem(convId, message) {
        // Format wenn Message = Objekt
        // const comment = {
        //     convId: convId,
        //     parentId: parentId,
        //     content: content
        // };
        return new Promise ((resolve, reject) => {
            client.addTextItem(convId, message)
                .then(/** @param {object} res */(res) => {
                    const resStr = JSON.stringify(res);
                    adapter.log.debug("addTextItem(): " + resStr);
                    resolve(res);
                })
                .catch(/** @param {object} error*/error => {
                    // const errorStr = JSON.stringify(error);
                    adapter.log.warn("addTextItem(), error.message: " + error.message);
                    reject(new Error(error.message));
                });
        });

    };




    //*********************************************************************
    //* sendItem
    //*********************************************************************

    // this.sendItem = function sendItem(convId,comment) {
    //     client.addTextItem(convId, comment);
    //     adapter.log.debug("[APP]: Bot Nachricht gesendet: " + JSON.stringify(comment));
    // };

    /** @param {string} convId - string mit der ID der Konversation @param {string} parentId @param {string} content - string mit dem Inhalt, der gesendet werden soll*/
    this.sendItem = function sendItem(convId, parentId, content) {
        const comment = {
            convId: convId,
            parentId: parentId,
            content: content
        };
        client.addTextItem(convId, comment);
        adapter.log.debug("[APP]: Bot Nachricht gesendet: " + JSON.stringify(comment));
    };

    //*********************************************************************
    //* reciveItem
    //*********************************************************************

    /** @param {object} evt */
    this.reciveItem = async function reciveItem(evt) {

        if(evt && evt.type === "itemAdded") {
            if(evt.item && evt.item.system && evt.item.system.type === "PARTICIPANT_REMOVED") {
                adapter.log.debug("reviceItem() 'PARTICIPANT_REMOVED' empfangen");
                this.particiapantRemoved(evt);
                return;
            }
        }

        const item = evt.item;

        const userId = item.creatorId; // userId, von dem die Nachricht kam
        const parentId = (item.parentItemId) ? item.parentItemId : item.itemId;
        const convId = item.convId;

        let itemUpdated = false;
        let itemDeleted = false;
        let urlItemUpdate = "";

        if(evt && evt.type === "itemUpdated") {
            itemUpdated = true;
            urlItemUpdate ="https://"+ adapter.config.circuit_domain +"/#/conversation/" + item.convId + "?item=" + item.itemId;
            if(item.text && item.text.state && item.text.state === "DELETED") {
                itemDeleted = true;
                adapter.log.debug("[APP]: reciveItem(): Nachricht wurde gelöscht " + urlItemUpdate);
                // hier kann auf gelöschte Nachrichten reagiert werden
                return;
            }
            adapter.log.debug("[APP]: reciveItem(): Update von " + urlItemUpdate);
            // hier kann auf bearbeitete Nachrichten reagiert werden
            // weiter im Verlauf
        }

        if (self.sentByMe(item)) {
            adapter.log.debug("[APP]: reciveItem(): skip it - I sent it");
            return;
        }
        if (item.type !== "TEXT") {
            adapter.log.debug("[APP]: reciveItem(): skip it - skip it is not text");
            return;
        }
        if (!item.text || !item.text.content) {
            adapter.log.debug("[APP]: reciveItem(): skip it - it does not have text");
            return;
        }

        adapter.log.info("[APP]: reciveItem() => zur Verarbeitung");

        // ermitteln, ob User oder der Bot direkt angesprochen (mention) wurden
        let mentionedUsersNumber = 0;
        let mentioned = false;
        if (item.text.mentionedUsers) {
            mentionedUsersNumber = item.text.mentionedUsers.length;
            if(item.text.mentionedUsers.indexOf(client.loggedOnUser.userId) > -1) mentioned = true;
        }

        adapter.log.debug("[APP]: reciveItem(): Anzahl der mentioned Users: " + mentionedUsersNumber);
        adapter.log.debug("[APP]: reciveItem(): Bot wurde angeschrieben (mention): " + mentioned);

        if(mentionedUsersNumber >0) adapter.log.info("[APP]: reciveItem(): Anzahl der angesprochenen (mention) Users: " + mentionedUsersNumber);


        try {

            const user = await self.getUserById(userId);

            // Textrückmeldungen:
            // item.text.content        kompletter Text in html
            // rawText                  reiner Text, inkl. aller Textupdates
            // lastRawText              nur der reine Text des letzten Updates

            const hrText = "<itemUpdated>"; // Text gegen das "<hr>"" ersetzt werdden soll

            let rawText = item.text.content.replace(/<span class="mention".*span> */gm, ""); //mention rausfiltern
            // rawText = htmlToText.fromString(rawText); // restliches html rausfiltern

            rawText = htmlToText.fromString(rawText, {
                // @ts-ignore
                format: {
                    horizontalLine: function () {
                        return hrText; 
                    }
                }
            }); // restliches html rausfiltern => <hr> bleibt <hr> !!! ACHTUNG, ggf. ändern. ein getipptes <hr> ist auch <hr> und nicht zu unterscheiden !!!

            const lastRawText = (itemUpdated) ? rawText.substr(rawText.lastIndexOf(hrText)+hrText.length,rawText.length) : rawText;

            adapter.log.debug("[APP]: reciveItem(): von: " + user.displayName + " #  Subject: " + item.text.subject + " # Orginaltext: " + item.text.content);
            // adapter.log.debug("[APP]: reciveItem(): von: " + user.displayName + " # Subject: " + item.text.subject + " # rawText: " + htmlToText.fromString(item.text.content));
            adapter.log.debug("[APP]: reciveItem(): von: " + user.displayName + " # Subject: " + item.text.subject + " # rawText ohne mention: '" + rawText + "'");
            adapter.log.info("[APP]: reciveItem(): von: " + user.displayName + " # Subject: " + item.text.subject + " # lastRawText ohne mention: '" + lastRawText + "'");

            if(user && user.userType === "BOT") {
                adapter.log.debug("[APP]: reciveItem(): skip it - another bot");
                return;
            }


            // Teilnehmer der Konversation ermitteln (ohne Bot) -> UserIDs in Array participants
            const participants = [];
            // const resParticipants = await self.getConversationParticipants(convId,{pageSize:100, includePresence: true});
            for (const participant of myConversations[convId].participants) {
                if(participant !== client.loggedOnUser.userId) participants.push(participant);
            }
            // adapter.log.debug("[APP]: reciveItem(): Anzahl Teilnehmer ohne Bot: " + resParticipants.participants.length);
            // adapter.log.debug("[APP]: reciveItem(): resParticipants: " + JSON.stringify(resParticipants));
            adapter.log.debug("[APP]: reciveItem(): Anzahl Teilnehmer (Bot nicht mitgezählt): " + participants.length);
            adapter.log.debug("[APP]: reciveItem(): resParticipants (Array der Teilnehmer userIds): " + JSON.stringify(participants));


            // -------------------------------------
            // Antworten des Bots auf eine Nachricht
            // -------------------------------------


            // lastRawtext => nicht die komplette Nachricht, sondern nur nach dem letzten Enter
            
            // Antwort, wenn der Bot angesprochen (mention) wurde
            if(mentioned) {
                adapter.log.info("[APP]: reciveItem(): Bot wurde angeschrieben (mention)");
                if(lastRawText.length === 0) { // Antwort bei Mention an den Bot ohne Inhalt
                    const content = "Hallo " + user.firstName + "<br><br>Ich bin für Dich da :-)";
                    self.sendItem(convId, parentId, content);
                    return;
                } else {
                    // Verarbeitung vom Mention an den Bot
                    return;
                }
            }

            adapter.log.debug("[APP]: reciveItem(): Typ der Konversation: " + myConversations[convId].type);
            // Antwort bei Direktkommunikation
            if(myConversations[convId].type === "DIRECT") {
                const content = "hallo " + user.firstName;
                self.sendItem(convId, parentId, content);
                return;
            }

            // Verarbeitung, wenn andere User angesprochen (mention) wurden, aber nicht der Bot
            if(!mentioned && (mentionedUsersNumber >0)) {
                adapter.log.info("[APP]: reciveItem(): Teilnehmer wurden angeschrieben (mention), aber nicht der Bot");
            }

        } catch (err) {
            adapter.log.warn("reciveItem(): "+ err);
            const content = "reciveItem(): " + err;
            self.sendItem(convId, parentId, content);
        }
    }; // end reciveItem()

}; // end Class CircuitBot





//*********************************************************************
//* circuitBot global -- (Circuit APP)
//*********************************************************************

// global, außerhalb von run() deklariert, damit auch das Adapter-Objekt darauf zugreifen kann, sowie main(), usw.
const circuitBot = new CircuitBot();




//*********************************************************************
//* regelmässie Wiederholung
//*********************************************************************


//*********************************************************************
//* run -- (Circuit APP)
//*********************************************************************
function run() {
    adapter.log.debug("run() -> Circuit [APP] gestartet");
    // const circuitBot = new CircuitBot();

    circuitBot.logon()
        .catch (function(e){
            if(!listenersOK) adapter.log.warn("Es kam kein Connecting. Listeners konnten wahrscheinlich nicht gesetzt werden. Circuit API der Domain " + adapter.config.circuit_domain + " nicht erreichbar?");
            if(!listenersOK) adapter.log.warn("Alternativ Secret überprüfen (Loglevel: silly) oder Secret neu eintragen");
            adapter.log.error("[APP]: run() Error Logon: " + e);
            adapter.setState("info.bot.lastLogonError", datumFomatieren(new Date(dateEpochNow())) + " - " + e, true);
        });

}


//*********************************************************************
//* onReady (Adapter Ready)
//*********************************************************************

// entschlüsselt das gespeicherte Secret und startet main()

function onReady() {

    adapter.setState("info.adapter.lastStart", datumFomatieren(new Date(dateEpochNow())) + " - Start des Adapters", true);
    adapter.setState("info.circuit.circuitDomain", adapter.config.circuit_domain || "eu.yourcircuit.com", true);

    if(adapter.log.level === "silly") {
        adapter.log.warn("#### ACHTUNG ####");
        adapter.log.warn("Loglevel ist SILLY. Sensitive Daten werden mit ausgegeben.");
        adapter.log.warn("Empfehlung: Log löschen, wenn es nicht mehr benötigt wird.");
        adapter.log.warn("#### ACHTUNG ####");
    }
    adapter.setState("info.connection", false, true);
    adapter.log.debug("ready - Adapter: databases are connected and adapter received configuration");
    if(adapter.log.level === "silly") adapter.log.warn("Achtung: Secret lesbar im Log");
    adapter.log.silly("config.client_secret verschlüsselt: " + adapter.config.client_secret);

    
    adapter.getForeignObject("system.config", (err, obj) => {
        try {
            if (obj && obj.native && obj.native.secret) {
                //noinspection JSUnresolvedVariable
                adapter.config.client_secret = decrypt(obj.native.secret, adapter.config.client_secret || "kein Secret vorhanden" );
            } else {
                //noinspection JSUnresolvedVariable
                adapter.config.client_secret = decrypt("Zgfr56gFe87jJOM", adapter.config.client_secret || "kein Secret vorhanden");
            }
                
        } catch (err) {
            adapter.log.warn("Error: " + err);
        }
        main();
    });
}


//*********************************************************************
//* main
//*********************************************************************


function main() {

    adapter.log.debug("Adapter main() gestartet");
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info("adapter.config.client_id: " + adapter.config.client_id);
    if(adapter.log.level !== "silly") adapter.log.debug("config.client_secret zur Anmeldung bei Circuit ausgeben: Loglevel auf silly stellen.");
    adapter.log.silly("adapter.config.client_secret: " + adapter.config.client_secret);
    adapter.log.info("adapter.config.circuit_domain: " + adapter.config.circuit_domain);
    adapter.log.info("adapter.config.standardconversation: " + adapter.config.standardconversation);
    /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
    */

    // besser ?: setObjectNotExist

    /*
    adapter.setObject("testVariable", {
        type: "state",
        common: {
            name: "testVariable",
            type: "boolean",
            role: "indicator",
            read: true,
            write: true,
        },
        native: {},
    });
    */

    adapter.subscribeStates("abfragen.getUserById");
    adapter.subscribeStates("abfragen.getUserByEmail");
    adapter.subscribeStates("abfragen.getConversationParticipants");
    adapter.subscribeStates("abfragen.getConversationById");
    adapter.subscribeStates("abfragen.getItemById");

    adapter.subscribeStates("commands.removeParticipant");

    adapter.subscribeStates("_sendToStandardConversation");

    // adapter.subscribeStates("*");
    /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
    */
    // the variable testVariable is set to true as command (ack=false)
    // adapter.setState("testVariable", true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    // adapter.setState("testVariable", { val: true, ack: true });

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    // adapter.setState("testVariable", { val: true, ack: true, expire: 30 });

    // examples for the checkPassword/checkGroup functions
    // adapter.checkPassword("admin", "iobroker", (res) => {
    // 	adapter.log.info("check user admin pw ioboker: " + res);
    // });

    // adapter.checkGroup("admin", "admin", (res) => {
    // 	adapter.log.info("check group user admin group admin: " + res);
    // });

    // adapter.terminate ? adapter.terminate() : process.exit()

    run(); // Starte Circuit App
}
