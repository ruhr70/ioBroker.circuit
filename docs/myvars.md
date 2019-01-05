# ioBroker Circuit Adapter myVars

Über Datenpunkte werden die Variablen, mit dem der Circuit Adapter intern arbeitet, bei AKtualisierung zur Verfünug gestellt. Der Adapter schreibt die Werte nur bei AKtualisierung, liest sie selbst aber nie.

Für eigene Skripte können die Variablen hilfreich sein, da sie automatisch aktualisiert werden und per Subscription on() an ein Skript gemeldet werden können.

Alle Variablen sind Objekte und als String im Datenpunkt gespeichert.

## Globale Variablen

### circuit.0.variablen.myConversations

### circuit.0.variablen.myUsers

### circuit.0.variablen.myUsersConversations

### circuit.0.variablen.myUsersList

### circuit.0.variablen.myUsersPresence

Subscription auf die Änderung von Präsenzinformationen bei den Teilnehmern. Die Variable wird als Ganzes neu geschrieben.

```js
on({id:"circuit.0.variablen.myUsersPresence",change: "ne"}, function(obj) {
    log(obj.state.val);
});
```

Einzelne Präsenzänderungen können über den Datenpunkt ```circuit.0.info.lastEvent``` aboniert werden. Dort werden alle Events von der API geschrieben. Ein Event bei Präsenzänderung eines Users hat den Typ ```"type":""userPresenceChanged"```.

```json
{"type":"userPresenceChanged","presenceState":{"userId":"c47114f4-80aa-4711-90d1-bf06c6474711","state":"AWAY","inTransit":false,"mobile":true,"poor":false,"isOptedOut":false}}
```