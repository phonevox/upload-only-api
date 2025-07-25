import { registerUserSchema, loginUserSchema, updateUserSchema, deleteUserSchema } from "../../schemas/v1/user.schema.js";
import { generateHash, comparePassword } from "../../utils/bcrypt/index.js";
import { tokenify, verifyToken } from "../../utils/jwt/index.js";
import { prisma } from "../../prisma/client.js";

export async function registerUser(req, res) {
    let validatedData;

    try {
        validatedData = registerUserSchema.parse(req.body);
    } catch (err) {
        const formatted = err.format();
        return res.status(400).send({ error: formatted });
    }

    const username = validatedData.username;
    const password = validatedData.password;
    const email = validatedData.email ?? null;
    const role = validatedData.role ?? 'user';

    if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).send({ error: "User already exists" });
        }
    }

    const hashedPassword = await generateHash(password);
    const token = await tokenify({ username, role });

    const user = await prisma.user.create({
        data: {
            username,
            email,
            password: hashedPassword,
            role,
            token
        }
    });

    return res.status(201).send({
        username: user.username,
        role: user.role,
    });
}


export async function loginUser(req, res) {
    let validatedData;

    try {
        validatedData = loginUserSchema.parse(req.body);
    } catch (err) {
        const formatted = err.format();
        return res.status(400).send({ error: formatted });
    }

    const { username, password } = validatedData;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        return res.status(401).send({ error: "User not found" });
    }

    console.log("user token: ", user.token);

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
        return res.status(401).send({ error: "Invalid password" });
    }

    const token = await tokenify({ username, role: user.role });

    await prisma.user.update({
        where: { username },
        data: { token }
    });

    return res.status(200).send({
        token: token
    });
}


export async function updateUser(req, res) {
    let validatedData;
    try {
        validatedData = updateUserSchema.parse({ username: req.params.username, ...req.body });
    } catch (err) {
        const formatted = err.format();
        delete formatted._errors;
        return res.status(400).send({ error: formatted });
    }

    const { username, password, email, role } = validatedData;

    if (username !== req.params.username) {
        return res.status(400).send({ error: "Username cannot be changed." });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (!existingUser) {
        return res.status(404).send({ error: "User not found." });
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (password !== undefined) updateData.password = await generateHash(password);

    const updatedUser = await prisma.user.update({
        where: { username },
        data: updateData,
    });

    return res.status(200).send({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        token: updatedUser.token,
    });
}


export async function deleteUser(req, res) {
    let validatedData;
    try {
        validatedData = deleteUserSchema.parse({ username: req.params.username });
    } catch (err) {
        const formatted = err.format();
        delete formatted._errors;
        return res.status(400).send({ error: formatted });
    }

    const { username } = validatedData;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        return res.status(200).send({ message: "User does not exist." });
    }

    await prisma.user.delete({ where: { username } });
    return res.status(204).send({ message: "User deleted successfully." });
}