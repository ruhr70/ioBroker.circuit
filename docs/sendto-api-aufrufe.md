# Beschreibung Circuit API Aufrufe über sendTo()

## Bereitgestellte API Funktionen

Übersicht der aus dem SDK bereitgestellten API Funktionen:

- getConversationById(convId)
- getConversationParticipants(convId,[options])
- getConversations ([options])

## Informationen zu sendTo()

[Beschreibung von sendTo() vom ioBorker JavaScript Adapter](https://github.com/ioBroker/ioBroker.javascript/blob/master/doc/en/javascript.md#sendto)

Dieses Kapitel enthält die Beschreibung der direkten API Aufrufe über ```sendTo()```. Die weiteren Möglichkeiten mit ```sendTo()```, wie z.B. das direkte Senden eines Textstrings an an die eingestellte Standardkonversation sind in der [**README.md**](./../README.md) beschrieben.

**Funktion sendTo():**

```js
sendTo(adapter, command, message, callback);
```

**command** ist optional und ```"send"``` wird als Voreinstellung geschickt.

Die Beispiele in dieser Beschreibung arbeiten alle ohne den optinalen parameter **command**, da die API Aufrufe die Voreinstellung für command verwenden:

```js
sendTo(adapter, message, callback);
```

Ein Callback kann nur genutzt werden, wenn der Adapter inkl. seiner Instanz angegeben wird, z.B. ```circuit.0```.

Aufrufe ohne Instanz werden an alle Adapter geschickt.

**Oder ohne Callback:**

```js
sendTo(adapter, message);
```

## getConversationById(convId)

API Beschreibung: [https://circuitsandbox.net/sdk/classes/Client.html#method_getConversationById](https://circuitsandbox.net/sdk/classes/Client.html#method_getConversationById)

Über ```getConversationById``` können Detailinformationen zu einer Konversation anhand der eindeutigen ```convId```  abgefragt werden.

**Ohne Skript:** Eine schnelle Onlineabfrage ist auch über den Datenpunkt ```circuit.0.abfragen.getConversationById``` möglich, der die ```convId``` als **string** erwartet. Das Ergebnis wird vom Adapter in den DatenPunkt ```circuit.0.abfragen.getConversationByIdAnswer``` geschrieben.

### getConversationById Aufruf

**Format der Message über sendTo():**

{object} message

```json
{
    "api": "getConversationById",
    "convId": convId
}
```

- ```convId``` {string} ID der Konversation als String

### getConversationById Rückgabe

```json
{
    "error": error,
    "result": result
}
```

- ```object.error``` {string} mit der Fehlermeldung im Fehlerfall. ```null``` im Gutfall.
- ```object.result``` {object} Antwort der API im Gutfall. ```null``` im Fehlerfall.

### getConversationById Beispielskript

```js
sendTo('circuit.0', {"api":"getConversationById","convId":"a9a54711-6d5a-43b6-89ee-99b748973a9a"}, function (res) {
    if(res.error) {
        log(res.error,"warn"); // {string} error
    } else {
        log('result: ' + JSON.stringify(res.result)); // Rückgabeabhängig von der API Funktion. Hier {object}
    }
});
```

Rückgabe ```res.result``` im Gutfall:

```json
{"type":"DIRECT","convId":"a9a54711-6d5a-43b6-89ee-99b748973a9a","participants":["cc21544e-a52c-4ccf-4711-f17e242f0815","5c522879-4711-41fe-0815-340c0162bf8d"],"userData":{"lastReadTimestamp":1546505193759,"unreadItems":0,"convId":"a9a54711-6d5a-43b6-89ee-99b748973a9a"},"topic":"","topLevelItem":{"type":"TEXT","parentItemId":"903c4711-b9ee-4f03-9520-f69bb13c796d","itemId":"8f574711-cc2e-496b-b773-9719d3667191","convId":"a9a54711-6d5a-43b6-89ee-99b748973a9a","text":{"state":"CREATED","contentType":"RICH","content":"An Instanz 1 mit Rückmeldung"},"creationTime":1546505193759,"modificationTime":1546505193759,"creatorId":"5c522879-4711-41fe-0815-340c0162bf8d","includeInUnreadCount":true,"dataRetentionState":"UNTOUCHED","hasDecryptionError":false,"attachments":[],"externalAttachments":[],"voting":null},"rtcSessionId":"c5a14711-e3d1-406f-a8f1-f396d2fa252b","isDeleted":false,"isTelephony":false,"retentionPolicyStatus":"ENABLED","creationTime":1544990187868,"modificationTime":1544990187868,"creatorId":"cc214711-a52c-4ccf-8e51-f17e242f35c6","lastItemModificationTime":1546505193759,"creatorTenantId":"5a1c4711-f47f-0815-8d67-6b79bc0a1234","creatorTenantName":"ioBroker AG","isTelephonyConversation":false,"isSupportConversation":false}
```

## getConversationParticipants(convId,[options])

API Beschreibung: [https://circuitsandbox.net/sdk/classes/Client.html#method_getConversationParticipants](https://circuitsandbox.net/sdk/classes/Client.html#method_getConversationParticipants)

Über ```getConversationParticipants``` können Detailinformationen zu einer Konversation anhand der eindeutigen ```convId```  abgefragt werden. Das Objekt ```options``` ist optional, so wie jeder einzelne Parameter innerhalb ```options```.

**Ohne Skript:** Eine schnelle Onlineabfrage ist auch über den Datenpunkt ```circuit.0.abfragen.getConversationParticipants``` möglich, der die ```convId``` als **string** erwartet. Das Ergebnis wird vom Adapter in den DatenPunkt ```circuit.0.abfragen.getConversationParticipantsAnswer``` geschrieben. Der Parameter ```options``` ist in der direkten Abfrage nciht vorgeshehen.

### getConversationParticipants Aufruf

**Format der Message über sendTo():**

{object} message

```json
{
    "api": "getConversationParticipants",
    "convId": convId,
    "options": {
        "searchCriterias": [
            {
                "criteria":"DISPLAY_NAME",
                "value":"Michael"
            },
            {
                "criteria":"TYPE",
                "value":"REGULAR"
            }
            ],
        "pageSize": 100,
        "includePresence": false
    }
}
```

- ```convId``` {string} ID der Konversation als String
- ```options``` {object} **optional**, alle Parameter innerhalb von ```options``` sind ebenfalls optional.

### getConversationParticipants Rückgabe

```json
{
    "error": error,
    "result": result
}
```

- ```object.error``` {string} mit der Fehlermeldung im Fehlerfall. ```null``` im Gutfall.
- ```object.result``` {object} Antwort der API im Gutfall. ```null``` im Fehlerfall.

### getConversationParticipants Beispielskript

**Beispiel 1 mit Options:**

```js
const convId = "a9a5e9b3-6d5a-43b6-89ee-99b748973a9a";

const message =
{
    "api": "getConversationParticipants",
    "convId": convId,
    "options": {
        "searchCriterias": [
            {
                "criteria":"DISPLAY_NAME",
                "value":"Michael"
            },
            {
                "criteria":"TYPE",
                "value":"REGULAR"
            }
            ],
        "pageSize": 100,
        "includePresence": false
    }
}

sendTo('circuit.1', message, function (res) {
    if(res.error) {
        log(res.error,"warn"); // {string} error
    } else {
        log('result: ' + JSON.stringify(res.result)); // Rückgabeabhängig von der API Funktion. Hier {object}
    }
});
```

Rückgabe ```res.result``` im Gutfall:

```json
{"participants":[{"type":"REGULAR","userId":"cc21544e-a52c-4ccf-8e51-f17e242f35c6","displayName":"Michael Herwig","isDeleted":false,"firstName":"Michael","lastName":"Herwig","avatar":"https://circuitsandbox.net/content/images/icon-general-default-avatar-yellow.png","avatarLarge":"https://circuitsandbox.net/content/images/icon-general-default-avatar-yellow-XL.png"}],"searchPointer":"banana-1","hasMore":false}
```

**Beispiel 2 ohne Options:**

```js
const convId = "a9a5e9b3-6d5a-43b6-89ee-99b748973a9a";

sendTo('circuit.1', {"api":"getConversationParticipants", "convId":convId}, function (res) {
    if(res.error) {
        log(res.error,"warn"); // {string} error
    } else {
        log('result: ' + JSON.stringify(res.result)); // Rückgabeabhängig von der API Funktion. Hier {object}
    }
});
```

Rückgabe ```res.result``` im Gutfall:

```json
{"participants":[{"type":"BOT","userId":"5c522879-f630-41fe-b0cf-340c0162bf8d","displayName":"TBS Bot","isDeleted":false,"firstName":"TBS","lastName":"Bot","avatar":"https://circuitsandbox.net/content/images/icon-general-default-avatar-orange.png","avatarLarge":"https://circuitsandbox.net/content/images/icon-general-default-avatar-orange-XL.png"},{"type":"REGULAR","userId":"cc21544e-a52c-4ccf-8e51-f17e242f35c6","displayName":"Michael Herwig","isDeleted":false,"firstName":"Michael","lastName":"Herwig","avatar":"https://circuitsandbox.net/content/images/icon-general-default-avatar-yellow.png","avatarLarge":"https://circuitsandbox.net/content/images/icon-general-default-avatar-yellow-XL.png"}],"searchPointer":"banana-2","hasMore":false}
```

## getConversations ([options])

API Beschreibung: [https://circuitsandbox.net/sdk/classes/Client.html#method_getConversations](https://circuitsandbox.net/sdk/classes/Client.html#method_getConversations)

Über ```getConversations``` kann die Liste der Konversationen abgefragt werden, an dem der Adapter Client beteiligt ist.

### getConversations Aufruf

**Format der Message über sendTo():**

{object} message

```json
{
    "api": "getConversations",
    "options": options
}
```

- **optional:** ```options``` {options} mit den jeweils optionalen Parametern ```direction```, ```timestamp```, ```numberOfConversations``` (Default 25), ```numberOfParticipants``` (Default 8).

### getConversations Rückgabe

```json
{
    "error": error,
    "result": result
}
```

### getConversations Beispielskript

**Beispiel mit Options:**

```js
const message = {
    "api": "getConversations",
    "options":{
        "numberOfPracticants":100
    }
}

sendTo('circuit.1', message, function (res) {
    if(res.error) {
        log(res.error,"warn"); // {string} error
    } else {
        log('result: ' + JSON.stringify(res.result));
    }
});
```

Rückgabe ```res.result``` im Gutfall:

```json
[{"type":"DIRECT","convId":"a9a5e9b3-6d5a-43b6-89ee-99b748973a9a","participants":["cc21544e-a52c-4ccf-8e51-f17e242f35c6","5c522879-f630-41fe-b0cf-340c0162bf8d"],"userData":{"lastReadTimestamp":1546505193759,"unreadItems":0,"convId":"a9a5e9b3-6d5a-43b6-89ee-99b748973a9a"},"topic":"","topLevelItem":{"type":"TEXT","parentItemId":"903c0f18-b9ee-4f03-9520-f69bb13c796d","itemId":"8f575504-cc2e-496b-b773-9719d3667191","convId":"a9a5e9b3-6d5a-43b6-89ee-99b748973a9a","text":{"state":"CREATED","contentType":"RICH","content":"An Instanz 1 mit Rückmeldung"},"creationTime":1546505193759,"modificationTime":1546505193759,"creatorId":"5c522879-f630-41fe-b0cf-340c0162bf8d","includeInUnreadCount":true,"dataRetentionState":"UNTOUCHED","hasDecryptionError":false,"attachments":[],"externalAttachments":[],"voting":null},"rtcSessionId":"c5a1a527-e3d1-406f-a8f1-f396d2fa252b","isDeleted":false,"isTelephony":false,"retentionPolicyStatus":"ENABLED","creationTime":1544990187868,"modificationTime":1544990187868,"creatorId":"cc21544e-a52c-4ccf-8e51-f17e242f35c6","lastItemModificationTime":1546505193759,"creatorTenantId":"5a1cc5e6-f47f-4ee1-8d67-6b79bc0ab28a","creatorTenantName":"Telefonbau Schneider","isTelephonyConversation":false,"isSupportConversation":false},{"type":"GROUP","convId":"707249f7-6916-47eb-a763-6100809cbfdd","participants":["cc21544e-a52c-4ccf-8e51-f17e242f35c6","078a13e2-64c6-4ce7-8ee2-2a513f44878b"],"userData":{"lastReadTimestamp":1545915462732,"unreadItems":2,"convId":"707249f7-6916-47eb-a763-6100809cbfdd"},"additionalUserData":{"leaveTime":1546623697906},"topic":"Gruppenkonversation mit TBS Bot","description":"Eine Beschreibung","topLevelItem":{"type":"SYSTEM","itemId":"0d6851c1-eb87-4183-a631-a18b5239ba97","convId":"707249f7-6916-47eb-a763-6100809cbfdd","system":{"type":"PARTICIPANT_REMOVED","affectedParticipants":["5c522879-f630-41fe-b0cf-340c0162bf8d"]},"creationTime":1546623697906,"modificationTime":1546623697906,"creatorId":"cc21544e-a52c-4ccf-8e51-f17e242f35c6","includeInUnreadCount":false,"dataRetentionState":"UNTOUCHED","hasDecryptionError":false},"rtcSessionId":"b5f50d68-b5be-48e2-9d6d-68101add8060","formerParticipants":[{"participant":{"userId":"482ebbdb-f137-4a27-8c08-023607be47eb"},"leaveTime":1545857296108},{"participant":{"userId":"5c522879-f630-41fe-b0cf-340c0162bf8d"},"leaveTime":1546623697906}],"isModerated":false,"isGuestAccessDisabled":false,"containsExternals":false,"isDeleted":false,"hasNoModerator":false,"retentionPolicyStatus":"ENABLED","creationTime":1545696542608,"modificationTime":1546623697960,"creatorId":"cc21544e-a52c-4ccf-8e51-f17e242f35c6","lastItemModificationTime":1546623697906,"creatorTenantId":"5a1cc5e6-f47f-4ee1-8d67-6b79bc0ab28a","conversationAvatar":{},"isTelephonyConversation":false,"isSupportConversation":false,"avatar":"https://circuitsandbox.net/content/images/icon-general-emptyconvo-avatar.png","avatarLarge":"https://circuitsandbox.net/content/images/icon-general-emptyconvo-avatar-XL.png"}]
```
