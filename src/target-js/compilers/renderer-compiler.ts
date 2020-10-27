import { ANodeCompiler } from './anode-compiler'
import { stringifier } from './stringifier'
import { ComponentInfo } from '../../models/component-info'
import { JSEmitter } from '../js-emitter'
import { Renderer } from '../../models/renderer'

const RENDERER_ARGS = ['data = {}', 'noDataOutput', 'runtime = sanSSRRuntime', 'parentCtx', 'tagName = "div"', 'slots']

/**
 * Each ComponentClass is compiled to a render function
 */
export class RendererCompiler {
    constructor (
        private ssrOnly: boolean,
        public emitter = new JSEmitter()
    ) {}

    /**
     * 把 ComponentInfo 编译成 Render 函数
     */
    public compileComponentRenderer (componentInfo: ComponentInfo): Renderer {
        this.emitter.clear()
        const body = this.compileComponentRendererBody(componentInfo)
        return new Function(...RENDERER_ARGS, body) as Renderer // eslint-disable-line no-new-func
    }

    /**
     * 把 ComponentInfo 编译成 Render JS 匿名函数源码
     */
    public compileComponentRendererSource (componentInfo: ComponentInfo) {
        this.emitter.writeAnonymousFunction(RENDERER_ARGS, () => {
            this.compileComponentRendererBody(componentInfo)
        })
        return this.emitter.fullText()
    }

    public compileComponentRendererBody (info: ComponentInfo) {
        const { emitter } = this
        // 没有 ANode 的组件，比如 load-success 样例
        if (!info.root) {
            emitter.writeLine('return ""')
            return emitter.fullText()
        }
        emitter.writeLine('var _ = runtime._;')
        emitter.writeLine('var html = "";')

        this.genComponentContextCode(info)
        emitter.writeLine('ctx.instance.data = new runtime.SanData(ctx.data, ctx.instance.computed)')
        emitter.writeLine('ctx.instance.parentComponent = parentCtx && parentCtx.instance')
        emitter.writeLine('var parentCtx = ctx;')

        // instance preraration
        if (info.hasMethod('initData')) {
            if (info.initData) this.emitInitDataInCompileTime(info.initData())
            else this.emitInitDataInRuntime()
        }

        // call inited
        if (info.hasMethod('inited')) {
            emitter.writeLine('ctx.instance.inited()')
        }

        // calc computed
        emitter.writeFor('var i = 0; i < ctx.computedNames.length; i++', () => {
            emitter.writeLine('var name = ctx.computedNames[i];')
            emitter.writeLine('data[name] = ctx.instance.computed[name].apply(ctx.instance);')
        })

        const aNodeCompiler = new ANodeCompiler(info, this.ssrOnly, emitter)
        aNodeCompiler.compile(info.root, true)

        emitter.writeLine('return html;')
        return emitter.fullText()
    }

    public emitInitDataInCompileTime (initData: any) {
        const defaultData = initData || {}
        for (const key of Object.keys(defaultData)) {
            this.emitter.writeLine('ctx.data["' + key + '"] = ctx.data["' + key + '"] || ' +
            stringifier.any(defaultData[key]) + ';')
        }
    }

    public emitInitDataInRuntime () {
        this.emitter.writeLine('var sanSSRInitData = ctx.instance.initData() || {}')
        this.emitter.writeFor('var key of Object.keys(sanSSRInitData)', () => {
            this.emitter.writeLine('ctx.data[key] = ctx.data[key] || sanSSRInitData[key]')
        })
    }

    /**
    * 生成组件 renderer 时 ctx 对象构建的代码
    */
    private genComponentContextCode (componentInfo: ComponentInfo) {
        const { emitter } = this
        emitter.writeLine(`let instance = _.createFromPrototype(runtime.resolver.getPrototype("${componentInfo.id}"));`)
        emitter.nextLine('let computedNames = [')
        emitter.write(componentInfo.getComputedNames().map(x => `'${x}'`).join(', '))
        emitter.feedLine('];')
        emitter.writeLine('var ctx = {instance, slots, data, parentCtx, computedNames}')
    }
}
