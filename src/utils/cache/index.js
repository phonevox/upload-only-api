import NodeCache from 'node-cache'

export const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 })

export const checkUserToken = (userId, token) => {
    const cachedToken = cache.get(`user:${userId}:token`)
    return cachedToken === token
}
