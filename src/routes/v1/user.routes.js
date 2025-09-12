import { registerUser, loginUser, updateUser, deleteUser, listUsers } from "../../controllers/v1/user.controller.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { Roles } from "../../enums/index.js";

export default async function userRoutes(fastify, opts) {
    fastify.get('/user', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN)],
        handler: listUsers
    })

    fastify.post('/user/login', loginUser)

    fastify.post('/user/register', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN)],
        handler: registerUser
    })

    fastify.patch('/user/:username', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN) ],
        handler: updateUser
    })
    fastify.delete('/user/:username', {
        onRequest: [requireAuth, requireRole(Roles.ADMIN, Roles.SUPERADMIN) ],
        handler: deleteUser
    })
}
