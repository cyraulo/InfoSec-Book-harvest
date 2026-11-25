import mongoose from 'mongoose';
import { config } from '../config.js';
import { connect, Session, User } from '../models.js';
import { hashPassword } from '../auth.js';
import { parse, registration } from '../validation.js';

try {
  const { password, ...profile } = parse(registration, {
    name: process.env.ADMIN_NAME ?? 'Folio Administrator',
    email: process.env.ADMIN_EMAIL ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  });
  if (password === 'replace-with-a-strong-unique-password') throw new Error('Replace the example ADMIN_PASSWORD.');
  await connect(config.mongoUri);
  const existing = await User.findOne({ email: profile.email });
  if (existing?.role === 'admin' && process.argv.includes('--rotate-password')) {
    const passwordHash = await hashPassword(password);
    await mongoose.connection.transaction(async session => {
      await User.updateOne({ _id: existing._id, role: 'admin' }, { $set: { passwordHash } }, { session });
      await Session.deleteMany({ user: existing._id }, { session });
    });
    console.log('Administrator password updated and existing sessions revoked.');
  } else if (existing?.role === 'admin') {
    console.log('Administrator already exists.');
  } else if (existing) {
    throw new Error('This email belongs to a customer. Choose a different administrator email.');
  } else {
    await User.create({ ...profile, passwordHash: await hashPassword(password), role: 'admin' });
    console.log('Administrator created.');
  }
} catch (error) {
  console.error(error.message, error.fields ?? '');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
