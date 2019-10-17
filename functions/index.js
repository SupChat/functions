const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
const messaging = admin.messaging()

exports.sendNotifications = functions
  .firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data()
    const conversationId = context.params.conversationId
    const fromDoc = await db.doc(`users/${message.from}`).get()
    const fromUser = fromDoc.data()

    const payload = {
      notification: {
        title: fromUser.displayName || 'UnKnown',
        body: message.text || 'UnKnown Message',
        icon: fromUser.photoURL,
        click_action: `https://react-firestore-chat.firebaseapp.com`,
      },
    }

    return db.doc(`conversations/${conversationId}`)
      .get()
      .then(conversation => {
        const { members } = conversation.data()
        return Promise.all(
          Object.keys(members)
            .filter((userId) => userId !== message.from)
            .map((userId) => db.doc(`users/${userId}`).get()),
        )
      })
      .then((docs) => {
        const tokens = docs.map(doc => doc.data()).map(({ token }) => token).filter(Boolean)
        console.log('tokens', tokens)
        return messaging.sendToDevice(tokens, payload)
      })
  })
