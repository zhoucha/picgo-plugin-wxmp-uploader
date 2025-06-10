import { PicGo } from 'picgo'
const CONFIG_NAME = 'picgo-plugin-wxmp'

export  const getAccessToken = async (appid: string, secret: string, ctx: PicGo) => {
  const tokenKey = CONFIG_NAME+'-accessToken'
  const localToken = ctx[tokenKey]
  try {
    if (!localToken || Date.now() - localToken.createTime >= localToken.expiresIn) {
      const tokenResponse:any = await ctx.request({
        url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,
        method: 'GET',
        json: true
      })
    
      if (tokenResponse?.errcode) {
        throw new Error(`获取Token失败: ${tokenResponse.errmsg}`)
      }
      const accessToken = tokenResponse.access_token || ""
      if (!accessToken.length) {
        throw new Error('获取的access_token为空')
      }
      const expiresIn = tokenResponse.expires_in * 1000
      ctx[tokenKey] = { accessToken, expiresIn, createTime: Date.now() }
      return accessToken
    }
    return localToken.accessToken
  } catch (error) {
    ctx.log.warn('#picgo-plugin-wxmp: 获取access_token失败...')
    throw error
  }
}
