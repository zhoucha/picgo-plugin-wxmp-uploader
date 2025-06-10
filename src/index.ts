import { PicGo } from 'picgo'
import { IPluginConfig  } from 'picgo/dist/utils/interfaces'
import { getAccessToken} from './wx'

// Define the IWechatConfig interface according to your config structure
const CONFIG_NAME = 'picgo-plugin-wxmp'

interface IWechatConfig {
  appId: string
  appSecret: string
  imageMaxSize: number,
  cdnPrefix?: string
}


export = (ctx: PicGo) => {

  const config = (): IPluginConfig[] => {
    return [
      {
        name: 'appId',
        type: 'input',
        message: '微信公众号AppID',
        required: true
      },
      {
        name: 'appSecret',
        type: 'password',
        message: '微信公众号AppSecret',
        required: true
      },
      {
        name: 'imageMaxSize',
        type: 'input',
        default: '5',
        message: '图片大小限制（MB，微信上限为10MB）',
        required: false
      },
    {
        name: 'cdnPrefix',
        type: 'input',
        alias: 'CDN前缀',
        default: '',
        message: 'CDN地址（用于解决防盗链问题，如：https://your-cdn.com）',
        required: false
      }
    ]
  }
  

  const handleUpload = async (ctx: PicGo): Promise<boolean> => {
    try {
      const userConfig = ctx.getConfig<IWechatConfig>(`picBed.${CONFIG_NAME}`)
      if (!userConfig) {
        throw new Error('未获取到微信图床配置')
      }
      const { appId, appSecret, imageMaxSize = 5 } = userConfig
      // const tokenResponse:any = await ctx.request({
      //   url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
      //   method: 'GET',
      //   json: true
      // })
      // ctx.log.info('tokenResponse:', tokenResponse);
      const accessToken = await getAccessToken(appId,appSecret, ctx)
      // 处理所有图片
      for (const img of ctx.output) {
        // 检查图片大小
        const imageSizeMB = img.buffer.length / (1024 * 1024)
        if (imageSizeMB > imageMaxSize) {
          throw new Error(`图片大小 ${imageSizeMB.toFixed(2)}MB 超过限制 ${imageMaxSize}MB`)
        }
        
        // 上传到微信
        ctx.log.info('upload :', img.fileName, img.extname, img.buffer.length, 'bytes');
        const uploadResponse:any = await ctx.request({
          url: `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`,
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          formData: {
            media: {
              value: img.buffer,
              options: {
                filename: img.fileName,
                contentType: img.extname ? `image/${img.extname}` : 'image/jpeg'
              }
            },
            type: "image"
          },
          json: true
        }) 
        ctx.log.info('微信图床上传响应',uploadResponse)

        if (uploadResponse.errcode) {
          throw new Error(`上传失败: ${uploadResponse.errmsg}`)
        }
        if (!uploadResponse.url) {
          throw new Error('微信图床返回的URL为空')
        }
        // // 保存结果
        img.imgUrl = uploadResponse.url
        img.fullResult = uploadResponse
      }
      return true
    } catch (err: any) {
      ctx.log.error('微信图床上传失败', err)
      ctx.emit('notification', {
        title: '微信图床错误',
        body: err.message || '未知错误'
      })
      return false
    }
  }

  

  const handleAfterUpload = async (ctx: PicGo): Promise<boolean> => {

    try{
      const userConfig = ctx.getConfig<IWechatConfig>(`picBed.${CONFIG_NAME}`)
      const cdnPrefix = userConfig?.cdnPrefix || ''
    // 这里可以处理上传后的逻辑，比如记录日志、发送通知等
      ctx.log.info('微信图床上传完成')
      
      //将微信原始URL转换为Markdown/CDN链接，通过afterUploadPlugins实现
      for (const img of ctx.output) {
        if (img.imgUrl) {

               // 应用CDN前缀解决防盗链问题
          let finalUrl = img.imgUrl
           if (cdnPrefix) {
            try {
              const parsedUrl = new URL(img.imgUrl)
              finalUrl = `${cdnPrefix}${parsedUrl.pathname}${parsedUrl.search}`
            } catch (e) {
              ctx.log.warn('CDN前缀应用失败，使用原始URL')
            }
          }
          // 这里假设你要将微信URL转换为Markdown格式
          img.imgUrl = finalUrl
          img.markdown = `![](${img.imgUrl})`
          ctx.log.info('微信图床上传完成，已应用CDN和Markdown转换')
        }
      }

    }catch(err: any) {
        ctx.log.error('上传后处理失败', err)
    }

     return true;
    }

  const register = (): void => {
    ctx.helper.uploader.register(CONFIG_NAME, {
      name: '微信公众号图床',
      handle: handleUpload,
      config: config,
      
    })
    ctx.helper.transformer.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
      }
    })
    ctx.helper.beforeTransformPlugins.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
      }
    })
    ctx.helper.beforeUploadPlugins.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
      }
    })
    ctx.helper.afterUploadPlugins.register(CONFIG_NAME, {
      handle : handleAfterUpload
    })
  }
  const commands = (ctx: PicGo) => [{
    label: '',
    key: '',
    name: '',
    async handle (ctx: PicGo, guiApi: any) {}
  }]
  return {
    uploader: CONFIG_NAME,
    transformer: CONFIG_NAME,
    commands,
    register
  }
}
