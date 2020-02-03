const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const firestore = admin.firestore()
const messaging = admin.messaging()

exports.sendNotifications = functions
  .firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data()
    const conversationId = context.params.conversationId
    const fromDoc = await firestore.doc(`users/${message.from}`).get()
    const fromUser = fromDoc.data()

    const payload = {
      notification: {
        title: fromUser.displayName || 'UnKnown',
        body: message.text || 'UnKnown Message',
        icon: fromUser.photoURL,
        click_action: `https://react-firestore-chat.firebaseapp.com`,
      },
    }

    return firestore.doc(`conversations/${conversationId}`)
      .get()
      .then(conversation => {
        const { members } = conversation.data()
        return Promise.all(
          Object.keys(members)
            .filter((userId) => userId !== message.from)
            .map((userId) => firestore.doc(`users/${userId}`).get()),
        )
      })
      .then((docs) => {
        const tokens = docs.map(doc => doc.data()).map(({ token }) => token).filter(Boolean)
        console.log('tokens', tokens)
        return messaging.sendToDevice(tokens, payload)
      })
  })

exports.onUserStatusChanged = functions.database.ref('/status/{uid}').onUpdate(
  async (change, context) => {
    const eventStatus = change.after.val();
    const userStatusFirestoreRef = firestore.doc(`users/${context.params.uid}`);
    const statusSnapshot = await change.after.ref.once('value');
    const status = statusSnapshot.val();
    if (status.last_changed > eventStatus.last_changed) {
      return null;
    }
    return userStatusFirestoreRef.set({
        status: {
          ...eventStatus,
          last_changed: new Date(eventStatus.last_changed)
        },
      }, { merge: true });
  });
