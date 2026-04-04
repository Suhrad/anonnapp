/**
 * Migration: Anonymize existing data
 *
 * For every existing User:
 *   1. Generate a random anonymousId (if not already present)
 *   2. Create a random AnonymousProfile (if not already present)
 *   3. Set User.anonymousId
 *
 * For every Post / Poll / Comment / ChatMessage / ChatGroup:
 *   4. Copy the ObjectId author/sender → look up the User's anonymousId → set anonAuthorId / anonSenderId
 *   5. Convert upvote/downvote/voter arrays from ObjectId to anonymousId string
 *
 * Safe to re-run: all operations are idempotent.
 *
 * Usage:
 *   node --experimental-vm-modules src/scripts/migrateToAnonymous.js
 *   (or via package.json script: "migrate:anon")
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';

// ---- Model imports ----
import User from '../models/User.js';
import AnonymousProfile from '../models/AnonymousProfile.js';
import Post from '../models/Post.js';
import Poll from '../models/Poll.js';
import Comment from '../models/Comment.js';
import ChatMessage from '../models/ChatMessage.js';
import ChatGroup from '../models/ChatGroup.js';

// ---- Helpers ----

const generateRandomUsername = () => {
  const adjectives = ['Silent', 'Hidden', 'Mystic', 'Shadow', 'Phantom', 'Cryptic', 'Veiled', 'Covert'];
  const nouns = ['Fox', 'Wolf', 'Raven', 'Owl', 'Hawk', 'Bear', 'Lynx', 'Viper'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9000 + 1000);
  return `${adj}${noun}${num}`;
};

const ensureUniqueUsername = async (base) => {
  let username = base;
  let attempt = 0;
  while (await AnonymousProfile.exists({ username })) {
    attempt += 1;
    username = `${base}_${attempt}`;
  }
  return username;
};

// Build a userId (string) → anonymousId (string) lookup map
const buildUserMap = async () => {
  const users = await User.find({}).select('_id anonymousId');
  const map = new Map();
  for (const user of users) {
    if (user.anonymousId) {
      map.set(user._id.toString(), user.anonymousId);
    }
  }
  return map;
};

// ---- Step 1: Create AnonymousProfiles for all users ----

const migrateUsers = async () => {
  console.log('\n[1/5] Migrating users → AnonymousProfiles...');
  const users = await User.find({});
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.anonymousId) {
      // Already migrated — ensure AnonymousProfile exists
      const exists = await AnonymousProfile.exists({ anonymousId: user.anonymousId });
      if (!exists) {
        const username = await ensureUniqueUsername(generateRandomUsername());
        await AnonymousProfile.create({ anonymousId: user.anonymousId, username });
        created += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const anonymousId = crypto.randomBytes(16).toString('hex');
    const username = await ensureUniqueUsername(generateRandomUsername());

    await AnonymousProfile.create({ anonymousId, username });
    await User.updateOne({ _id: user._id }, { anonymousId });
    created += 1;
  }

  console.log(`   Created: ${created}  Skipped: ${skipped}`);
};

// ---- Step 2: Migrate Posts ----

const migratePosts = async (userMap) => {
  console.log('\n[2/5] Migrating posts...');
  // Find posts that still use the old ObjectId author field
  const posts = await Post.find({ author: { $exists: true }, anonAuthorId: { $exists: false } }).lean();
  let updated = 0;

  for (const post of posts) {
    const anonAuthorId = userMap.get(post.author?.toString());
    if (!anonAuthorId) continue;

    // Convert vote arrays (ObjectId → anonymousId)
    const upvotes = (post.upvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);
    const downvotes = (post.downvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);

    await Post.updateOne(
      { _id: post._id },
      {
        $set: { anonAuthorId, upvotes, downvotes },
        $unset: { author: '' },
      }
    );
    updated += 1;
  }

  console.log(`   Updated: ${updated}`);
};

// ---- Step 3: Migrate Polls ----

const migratePolls = async (userMap) => {
  console.log('\n[3/5] Migrating polls...');
  const polls = await Poll.find({ author: { $exists: true }, anonAuthorId: { $exists: false } }).lean();
  let updated = 0;

  for (const poll of polls) {
    const anonAuthorId = userMap.get(poll.author?.toString());
    if (!anonAuthorId) continue;

    const upvotes = (poll.upvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);
    const downvotes = (poll.downvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);
    const voters = (poll.voters || []).map((id) => userMap.get(id.toString())).filter(Boolean);

    // Convert per-option vote arrays
    const options = (poll.options || []).map((opt) => ({
      ...opt,
      votes: (opt.votes || []).map((id) => userMap.get(id.toString())).filter(Boolean),
    }));

    await Poll.updateOne(
      { _id: poll._id },
      {
        $set: { anonAuthorId, upvotes, downvotes, voters, options },
        $unset: { author: '' },
      }
    );
    updated += 1;
  }

  console.log(`   Updated: ${updated}`);
};

// ---- Step 4: Migrate Comments ----

const migrateComments = async (userMap) => {
  console.log('\n[4/5] Migrating comments...');
  const comments = await Comment.find({ author: { $exists: true }, anonAuthorId: { $exists: false } }).lean();
  let updated = 0;

  for (const comment of comments) {
    const anonAuthorId = userMap.get(comment.author?.toString());
    if (!anonAuthorId) continue;

    const upvotes = (comment.upvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);
    const downvotes = (comment.downvotes || []).map((id) => userMap.get(id.toString())).filter(Boolean);

    await Comment.updateOne(
      { _id: comment._id },
      {
        $set: { anonAuthorId, upvotes, downvotes },
        $unset: { author: '' },
      }
    );
    updated += 1;
  }

  console.log(`   Updated: ${updated}`);
};

// ---- Step 5: Migrate Chat ----

const migrateChat = async (userMap) => {
  console.log('\n[5/5] Migrating chat messages and groups...');

  // ChatMessages
  const messages = await ChatMessage.find({ sender: { $exists: true }, anonSenderId: { $exists: false } }).lean();
  let msgUpdated = 0;
  for (const msg of messages) {
    const anonSenderId = userMap.get(msg.sender?.toString());
    if (!anonSenderId) continue;
    await ChatMessage.updateOne(
      { _id: msg._id },
      { $set: { anonSenderId, isEncrypted: false }, $unset: { sender: '' } }
    );
    msgUpdated += 1;
  }
  console.log(`   Messages updated: ${msgUpdated}`);

  // ChatGroups
  const groups = await ChatGroup.find({ createdBy: { $exists: true }, anonCreatedBy: { $exists: false } }).lean();
  let grpUpdated = 0;
  for (const group of groups) {
    const anonCreatedBy = userMap.get(group.createdBy?.toString());
    if (!anonCreatedBy) continue;

    const members = (group.members || []).map((m) => {
      const anonUserId = userMap.get((m.user || m.anonUserId)?.toString());
      if (!anonUserId) return null;
      return { anonUserId, role: m.role || 'member', joinedAt: m.joinedAt || new Date() };
    }).filter(Boolean);

    await ChatGroup.updateOne(
      { _id: group._id },
      { $set: { anonCreatedBy, members }, $unset: { createdBy: '' } }
    );
    grpUpdated += 1;
  }
  console.log(`   Groups updated: ${grpUpdated}`);
};

// ---- Main ----

const run = async () => {
  console.log('🔐 Starting anonymization migration...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    await migrateUsers();
    const userMap = await buildUserMap();
    console.log(`   User map built: ${userMap.size} entries`);

    await migratePosts(userMap);
    await migratePolls(userMap);
    await migrateComments(userMap);
    await migrateChat(userMap);

    console.log('\n✅ Migration complete. All existing data has been anonymized.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
