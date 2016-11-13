/* eslint-env browser */
/* global firebase, google */

// Initialize Firebase
var config = {
  apiKey: 'AIzaSyD-Ni9e1uCrPQm8_fsyAZZv6oIK2OUWdeA',
  authDomain: 'destina.firebaseapp.com',
  databaseURL: 'https://destina.firebaseio.com',
  storageBucket: 'firebase-destina.appspot.com',
  messagingSenderId: '691293215935'
};
firebase.initializeApp(config);

/**
* Reference to Firebase database.
* @const
*/
var database = firebase.database();
var auth = firebase.auth();

/**
* Data object to be written to Firebase.
*/
var data = {
  timestamp: null,
  sender: null,
  senderName: null,
  comment: null,
  lat: null,
  lng: null,
  iconColor: null
};

var app = {
  isLoading: true,
  spinner: document.querySelector('.loader'),
  container: document.getElementById('map'),
  nameForm: document.getElementById('display-name-div'),
  nameInput: document.getElementById('display-name-text'),
  addDialog: document.querySelector('.add-dialog'),
  commentInput: document.getElementById('comment-input'),
  saveButton: document.getElementById('save-marker-btn')
};

function initAddDialog() {
  app.addDialog.hidden = false;
  app.addDialog.style.display = 'block';
  app.commentInput.textContent = '🌴 😀 ⛱';
}


/**
* Starting point for running the program. Authenticates the user.
* @param {function()} onAuthSuccess - Called when authentication succeeds.
*/
function initAuthentication(onAuthSuccess) {
  auth.signInAnonymously().catch(function(error) {
    // Handle Errors here.
    console.log('Login failed!', error.code, error.message);
  });

  auth.onAuthStateChanged(function(user) {
    if (user) {
      // User is signed in.
      // var isAnonymous = user.isAnonymous;
      var uid = user.uid;
      data.sender = uid;
      var currentUserHue = Math.floor(Math.random() * 360);
      data.iconColor = 'hsl(' + currentUserHue + ', 70%, 50%)';
      app.nameForm.hidden = false;
      app.nameForm.style.display = 'block';
      onAuthSuccess();
    } else {
      // User is signed out.
      // ...
    }
  });
}

/**
 * Creates a map object with a click listener and a heatmap.
 */
function initMap() {
  var map = new google.maps.Map(app.container, {
    center: {lat: 22.07, lng: -159.51},
    zoom: 11,
    disableDoubleClickZoom: true,
    streetViewControl: false,
    clickableIcons: false
  });

  map.infoWindow = new google.maps.InfoWindow();

  // Listen for clicks and add the location of the click to firebase.
  map.addListener('click', function(e) {
    initAddDialog();
    var latLng = e.latLng;
    data.lat = latLng.lat();
    data.lng = latLng.lng();
    map.infoWindow.setOptions({
      content: app.addDialog,
      position: latLng
    });
    map.infoWindow.open(map);
  });

  app.saveButton.addEventListener('click', function() {
    data.senderName = app.nameInput.value || 'anonymous';
    data.comment = app.commentInput.value;
    addToFirebase(data);
    map.infoWindow.close();
  });

  initAuthentication(initFirebase.bind(undefined, map));
}

function initFirebase(map) {
  // Reference to the clicks in Firebase.
  var clicks = database.ref().child('clicks');
  var markers = {};

  // Listener for when a click is added.
  clicks.on('child_added',
    function(snapshot) {
      // Get that click from firebase.
      var newPosition = snapshot.val();
      var point = new google.maps.LatLng(newPosition.lat, newPosition.lng);
      var symbol = {
        path: 'M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z',
        fillColor: newPosition.iconColor || 'RoyalBlue',
        fillOpacity: 1,
        strokeWeight: 0,
        anchor: new google.maps.Point(12, 24),
        scale: 1.5
      };
      var marker = new google.maps.Marker({
        position: point,
        map: map,
        icon: symbol
      });
      markers[snapshot.key] = marker;
      marker.addListener('click', function() {
        map.infoWindow.setOptions({
          content: '<i>' + newPosition.senderName + ' says:</i><br>'
            + newPosition.comment
        });
        map.infoWindow.open(map, marker);
      });
    }
  );

  // Listener for when a click is removed.
  clicks.on('child_removed',
    function(snapshot) {
      // Find the marker by key and hide.
      var keyToRemove = snapshot.key;
      markers[keyToRemove].setMap(null);
      delete markers[keyToRemove];
    }
  );
}

/**
 * Updates the last_message/ path with the current timestamp.
 * @param {function(Date)} addClick After the last message timestamp has been
 *     updated, this function is called with the current timestamp to add the
 *     click to the firebase.
 */
function getTimestamp(addClick) {
  // Reference to location for saving the last click time.
  var ref = database.ref().child('last_message/' + data.sender);

  ref.onDisconnect().remove();  // Delete reference from firebase on disconnect.

  // Set value to timestamp.
  ref.set(firebase.database.ServerValue.TIMESTAMP, function(err) {
    if (err) {  // Write to last message was unsuccessful.
      console.log(err);
    } else {  // Write to last message was successful.
      ref.once('value', function(snap) {
        addClick(snap.val());  // Add click with same timestamp.
      }, function(err) {
        console.warn(err);
      });
    }
  });
}

/**
 * Adds a click to firebase.
 * @param {Object} data The data to be added to firebase.
 *     It contains the lat, lng, sender and timestamp.
 */
function addToFirebase(data) {
  getTimestamp(function(timestamp) {
    // Add the new timestamp to the record data.
    data.timestamp = timestamp;
    var ref = database.ref().child('clicks').push(data, function(err) {
      if (err) {  // Data was not written to firebase.
        console.warn(err);
      }
    });
  });
}
