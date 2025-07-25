import { Role } from '../generated/prisma/index.js';

export const Roles = {
    SUPERADMIN: Role.superadmin,
    ADMIN: Role.admin,
    USER: Role.user
}
