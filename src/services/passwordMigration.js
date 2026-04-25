import { hashPassword } from './passwordService';

export const initializeHashedPasswords = async (users) => {
  const usersWithHashedPasswords = await Promise.all(
    users.map(async (user) => {
      if (!user.password.startsWith('$2a$')) {
        const hashedPassword = await hashPassword(user.password);
        return { ...user, password: hashedPassword };
      }
      return user;
    })
  );
  return usersWithHashedPasswords;
};

export const isPasswordHashed = (password) => {
  return password.startsWith('$2a$') || password.startsWith('$2b$');
};