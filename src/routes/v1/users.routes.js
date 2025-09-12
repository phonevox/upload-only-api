import { registerUser, loginUser, updateUser, deleteUser, listUsers } from "../../controllers/v1/users.controller.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { Roles } from "../../enums/index.js";

export default async function userRoutes(fastify, opts) {
    fastify.get('/users', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN)],
        handler: listUsers
    })

    fastify.post('/users/login', loginUser)

    fastify.post('/users/register', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN)],
        handler: registerUser
    })

    fastify.patch('/users/:username', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN) ],
        handler: updateUser
    })
    fastify.delete('/users/:username', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN) ],
        handler: deleteUser
    })
}
