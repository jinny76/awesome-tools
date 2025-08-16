[TOC]

### 翠鸟云SDK

翠鸟云SDK是一套基于翠鸟云本地安装环境的开发套件, 支持使用Vue3框架集成翠鸟云的三维能力开发自己的应用系统.


### 安装

翠鸟云SDK使用标准的npm分发, 您可以使用npm, cnpm, pnpm等工具进行安装

```
npm install kingfisher-cloud-sdk -S
```

### 应用开发包

建议在项目的index.js中引入开发包

```
import KingfisherUI from 'kingfisher-cloud-sdk'
import 'kingfisher-cloud-sdk/style.css'
import 'kingfisher-cloud-sdk/iconfont.css'
```

### 配置

使用翠鸟云SDK, 需要在本地环境安装翠鸟云基础及以上版本, 开具有效的账户后使用, 账号至少需要有三维设计器查看者权限.

```
KingfisherUI.configuration({
    server: "http://xxx.xxx.xxx.xxx:xxxxx",
    userId: "<user id>",
    password: "<password>"
})

createApp(App).use(KingfisherUI).mount('#app')
```

如果不希望暴露用户名密码, 可以在三维设计器中, 通过菜单获取令牌, 使用令牌登录

>[success] 令牌一旦生成无法查询, 请妥善保存

```
KingfisherUI.configuration({
    server: "http://xxx.xxx.xxx.xxx:xxxxx",
    ticket: "PTT-XXXX"
})

createApp(App).use(KingfisherUI).mount('#app')
```

| 参数  | 必须 | 描述  |
| ------------ | ------------ | ------------ |
|  server | 是 | 翠鸟云的网址, 包括IP, 域名及端口, 如果网站发布为https, 则这个网址也应该是https协议, 以免出现跨协议无法访问的问题 |
|  userId | 否 | 翠鸟云账户名, 区分大小写 |
|  password | 否 | 翠鸟云密码, 区分大小写 |
|  ticket | 否 | 登录令牌, 区分大小写 |
|  detailLog | 否 | 打印详细日志, 默认否 |
|  allowStatistics | 否 | 是否开启统计页面, 默认否, 打开后, 按热键ctrl+alt+shift+s可以显示统计页面 |

这样组件就已经注册好了, 在其他的vue文件里面就可以直接使用

### 使用组件

翠鸟云SDK一共提供了三个组件, Web3d, Diagram3d和Space3d. 文档后面会对每个组件进行详细描述.

```
<template>
  <div style="width: 100%; height: 100%">
    <web3d :props="web3dProps" @scene-load="sceneLoad" @loader-hide="loaderHide" @tap="tap" @render="render" ref="web3d"></web3d>
  </div>
</template>

<script>
...
    const web3dSetting = new KingfisherUI.Web3dProps();
    web3dSetting.sceneUrl = '1403/52453';
    web3dSetting.debugPuzzle = false;

    const web3dProps = ref(web3dSetting);
    const web3d = ref();

    const sceneLoad = (e) => {
      console.log('sceneLoad', e)
    }

    const loaderHide = (e) => {
      console.log('loaderHide', e)
    }

    const tap = (e) => {
      console.log('tap', e)
    }

    const render = (e) => {
      console.log('render', e)
    }
...
</script>
```

### Web3d组件

此组件用于加载展示在翠鸟三维设计器/翠鸟艺术家中制作的三维场景, 并使用SDK的库进行交互操作.

##### 属性
| 属性  | 类型  | 必须  | 描述  |
| ------------ | ------------ | ------------ | ------------ |
|  sceneUrl | String  | 是  | 场景ID, 格式为<项目Id>/<场景ID>, 例如 1234/5678 |
| camera  | String  | 否  | 场景加载后的默认机位, 默认空  |
| event  | String  |  否 | 场景加载后默认触发的事件, 默认空 |
| workerRender  | Boolean | 否  | 是否使用线程渲染, 默认否 |
| logo  |  String |  否 | 自定义加载图标URL, 可以是相对URL, 也可以是绝对URL, 默认空 |
| logoSize  |  String |  否 | 加载图标尺寸, 格式为<width>,<height>, 例如480,320, 默认空  |
| disableHardwareScaling  | Boolean  |  否 | 是否禁用硬件缩放, 默认否  |
| renderWidth  | Number  |  否 | 渲染宽度限制, 超大屏幕如果渲染尺寸过大可能会导致卡顿, 默认空  |
| renderHeight  | Number  |  否 | 渲染高度限制, 默认空  |
| sceneBackgroundImage  | String  |  否 | 场景背景图, 可以是相对URL, 也可以是绝对URL, 默认空  |
| sceneBgAspect  | Boolean  |  否 | 保持图片比率, 默认否  |
| sceneBgScale  |  Number | 否  |  图片缩放率, 默认1 |
| sceneForegroundImage  |  String |  否 |  场景前景图, 可以是相对URL, 也可以是绝对URL, 默认空 |
| sceneFgAspect  | Boolean  | 否  | 保持图片比率, 默认否  |
| sceneFgScale  |  Number | 否 | 图片缩放率, 默认1  |
| showStats  |  Boolean | 否  | 是否显示帧率统计, 默认否  |
| debugPuzzle  | Boolean  | 否  | 是否调试拼图脚本, 默认否  |

##### 事件
| 事件  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  sceneLoad | 对象, scene属性为当前场景对象 | 场景加载完成后触发 |
|  loadingHide | 对象, scene属性为当前场景对象 | 场景加载Logo消失后触发 |
|  tap | 对象, pointerInfo属性为点击信息对象 | 点击场景后触发 |
|  render | 对象, engine属性引擎对象, sceneManager属性为场景管理器对象, scene属性为当前场景对象 | 场景每一帧时触发 |

##### 方法
| 方法  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  getWeb3dManager | web3d组件实例 | 获取管理器对象实例, KingfisherUI.getWeb3dManager(web3d) |

### 管理器

管理器提供了大量方法来操作场景, 方法的第一个参数是当前场景, 可以传入manager.scene对象

```
    let sdk = KingfisherUI.getWeb3dManager(web3d); //获取管理器
    console.log(sdk.getAllCameraArgs(sdk.scene)); //获取所有机位
    sdk.setActiveCameraArg(sdk.scene, "机位.1", 2); //设置当前机位
```

#### **获取节点**

##### 按名字获取场景中的节点

    /**
     * 按名字获取场景中的节点
     * @param scene 场景对象
     * @param name 物体的名字
     * @returns 节点id或undefined
     */
	 public static getNodeByName(scene: Scene, name: string): string;

##### 获取场景中所有模型的列表

    /**
     * 获取场景中所有模型的列表
     * @param scene 场景对象
     * @returns 模型列表
     */
	 public static getAllMeshes(scene: Scene): Mesh[];

##### 获取场景中所有轴的列表

    /**
     * 获取场景中所有轴的列表
     * @param scene 场景对象
     */
	 public static getAllTransformNodes(scene: Scene): TransformNode[];

##### 按名字获取场景里的灯光

    /**
     * 按名字获取场景里的灯光
     * @param scene 场景对象
     * @param name 灯光的名字
     * @returns 灯光id或undefined
     */
    public static getLightByName(scene: Scene, name: string): Light;
	

#### **材质设置**

##### 获取场景中所有材质的列表

    /**
     * 获取场景中所有材质的列表
     * @param scene 场景对象
     * @returns 材质球列表
     */
	 
    public static getAllMaterials(scene: Scene): Material[];
	
##### 按名字获取场景里的材质

    /**
     * 按名字获取场景里的材质
     * @param scene 场景对象
     * @param name 材质的名字
     * @returns 材质或undefined
     */
    public static getMaterialByName(scene: Scene, name: string): Material;
	
##### 设置材质颜色

	/**
     * 设置材质颜色
     * @param scene 场景对象
     * @param material 材质
     * @param color 颜色
     */
    public static setMaterialColor(scene: Scene, material: string, color: string);

#### **可见度设置**

##### 判断轴是否可见

    /**
     * 判断轴是否可见
     * @param scene 场景对象
     * @param transformNode 轴
     * @returns 若找到轴, 返回轴是否可见, 否则返回undefined
     */
    public static transformNodeIsVisible(scene: Scene, transformNode: string): bool | undefined;

##### 判断模型是否可见

    /**
     * 判断模型是否可见
     * @param scene 场景对象
     * @param mesh 模型
     * @returns 若找到模型, 返回模型是否可见, 否则返回undefined
     */
    public static meshIsVisible(scene: Scene, mesh: string): bool | undefined;
	
##### 设置场景物体的可见度

	/**
     * 设置场景物体的可见度
     * @param scene 场景对象
     * @param object 物体
     * @param visibility 可见度 (有效范围为[0, 1])
     */
    public static setObjectVisibility(scene: Scene, object: string, visibility: number);
	
##### 隐藏物体

    /**
     * 隐藏物体
     * @param scene 场景对象
     * @param object 物体id
     * @param actionTimeInSeconds 动画时长
     */
    public static hideObject(scene: Scene, object: string, actionTimeInSeconds = 0);
	
##### 显示物体

	/**
     * 显示物体
     * @param scene 场景对象
     * @param object 物体id
     * @param actionTimeInSeconds 动画时长
     */
    public static showObject(scene: Scene, object: string, actionTimeInSeconds = 0);
	
#### **物体设置**

##### 平移物体

    /**
     * 平移物体
     * @param scene 场景对象
     * @param object 物体
     * @param vector 平移矢量
     * @param space 空间. 0为模型空间, 1为世界空间
     */
    public static translateObject(scene: Scene, object: string, vector: Vector3, space: Space = Space.LOCAL);

##### 对物体进行自转或公转

    /**
     * 对物体进行自转或公转
     * @param scene 场景对象
     * @param object 物体
     * @param axis 转动方向
     * @param amountInDegree 转动角度
     * @param space 转动空间. 0为模型空间(自转), 1为世界空间(公转)
     */
    public static rotateObject(scene: Scene, object: string, axis: Vector3, amountInDegree: number, space: Space = Space.LOCAL);

##### 绕世界空间中过一点的轴转动物体

    /**
     * 绕世界空间中过一点的轴转动物体
     * @param scene 场景对象
     * @param object 物体
     * @param point 转动点
     * @param axis 转动方向
     * @param amountInDegree 转动角度
     */
    public static rotateObjectAroundPointAxis(scene: Scene, object: string, point: Vector3, axis: Vector3, amountInDegree: number);
	
##### 缩放物体

	/**
     * 缩放物体
     * @param scene 场景对象
     * @param object 物体
     * @param vector 缩放倍率 (x, y, z)
     */
    public static scaleObject(scene: Scene, object: string, vector: Vector3);
	
##### 设置物体阴影

	/**
     * 设置物体阴影
     * @param scene 场景对象
     * @param {Object} meshId 模型对象对象Id
     * @param {Boolean} receiveShadows 接收阴影
     * @param {Boolean} castShadows 投射阴影
     */
    public static setMeshShadows(scene: Scene, meshId: string, receiveShadows?: boolean, castShadows?: boolean);
	
##### 销毁模型

	/**
     * 销毁模型
     * @param scene 场景对象
     * @param meshId 模型id
     */
    public static disposeMesh(scene: Scene, meshId: string);
	
##### 设置模型材质

	/**
     * 设置模型材质
     * @param scene 当前场景对象
     * @param meshId 模型对象对象Id
     * @param materialId 材质对象对象Id
     * @returns boolen 成功或失败
     */
    public static setMaterial(scene: Scene, meshId: string, materialId: string): boolean;
	
##### 通过名称设置模型材质

	/**
     * 通过名称设置模型材质
     * @param scene 当前场景对象
     * @param meshName 模型对象对象名称
     * @param materialName 材质对象对象名称
     * @returns boolean 成功或失败
     */
    public static setMaterialName(scene: Scene, meshName: string, materialName: string): boolean;
	
##### 获取节点属性

	/**
     * 获取节点属性
     * @param scene 当前场景对象
     * @param nodeId 模型对象对象Id
     * @param prop 属性
     * @param targetValue 目标值
     * @returns any 属性值
     */
    public static getNodePropValue(scene: Scene, nodeId: string, prop: string): any;
	
##### 设置节点属性

	/**
     * 设置节点属性
     * @param scene 当前场景对象
     * @param nodeId 模型对象对象Id
     * @param prop 属性
     * @param targetValue 目标值
     * @param params 目标值
     * @returns boolean 成功或失败
     */
    public static setNodePropValue(scene: Scene, nodeId: string, prop: string, targetValue: any, params: any): boolean;
	
#### **相机/机位设置**

##### 获取场景中所有机位的列表

    /**
     * 获取场景中所有机位的列表
     * @param scene 场景对象
     * @returns 机位列表
     */
	 public static getAllCameraArgs(scene: Scene): CameraArgs[];

##### 按名字获取场景中的机位

    /**
     * 按名字获取场景中的机位
     * @param scene 场景对象
     * @param name 机位名称
     * @returns 机位或undefined
     */
	 public static getCameraArgsByName(scene: Scene, name: string): CameraArgs;

##### 返回当前机位

	 
    /**
     * 返回当前机位
     * @param scene 场景对象
     * @returns 当前机位
     */
    public static getCameraStatus(scene: Scene): CameraArgs;
	
##### 平滑过渡到指定机位

	/**
     * 平滑过渡到指定机位
     * @param scene 场景对象
     * @param newStatus 新机位
     * @param animationTimeInSeconds 动画时长
     */
    public static transitionCameraToStatus(scene: Scene, newStatus: OrbitCameraArgs, animationTimeInSeconds = 0);

##### 平滑过渡到指定目标

    /**
     * 平滑过渡到指定目标
     * @param scene 场景对象
     * @param objectId 目标物体
     * @param animationTimeInSeconds 动画时长
     */
    public static focusCameraOnObject(scene: Scene, objectId: string, animationTimeInSeconds = 0);
	
##### 设置镜头视角

	 /**
     * 设置镜头视角
     * @param scene 场景对象
     * @param fovInDegree 视角（角度）
     */
    public static setCameraFov(scene: Scene, fovInDegree: number);
	
##### 将镜头设为正交模式

	/**
     * 将镜头设为正交模式(无透视效果)
     * @param scene 场景对象
     */
    public static makeCameraOrthographic(scene: Scene);

##### 将镜头设为透视模式

    /**
     * 将镜头设为透视模式(近大远小)
     * @param scene 场景对象
     * @param newStatus 新机位
     * @param animationTimeInSeconds 动画时长
     */
    public static makeCameraPerspective(scene: Scene, newStatus?: OrbitCameraArgs, animationTimeInSeconds = 0);

##### 设置机位旋转动画

    /**
     * 设置机位旋转动画
     * @param scene 场景对象
     * @param cameraName 机位名称
     * @param {Object} options 参数
     *  autoRotate:{Number} 自动旋转
     *  rotateDuration:{Number} 旋转一周时间
     *  invertRotate:{Number} 逆时针旋转
     *  rotateWaitTime:{Number} 旋转等待时间
     */
    public static setupCameraArgsRotation(scene: Scene, cameraName: string, options: {autoRotate: boolean, rotateDuration: number, invertRotate: boolean, rotateWaitTime: number});
	
##### 设置摄像机机位

	/**
     * 设置摄像机机位
     * @param scene 场景对象
     * @param cameraName 摄像机机位名称
     * @param duration 动画时长, 默认1秒
     */
    public static setActiveCameraArg(scene: Scene, cameraName: string, duration: number = 1);
	
##### 复位摄像机机位

	/**
     * 复位摄像机机位
     * @param scene 场景对象
     * @param duration 动画时长, 默认1秒
     */
    public static resetCameraToDefault(scene: Scene, duration: number = 1);
	
##### 添加Camera回调

	/**
     * 添加Camera回调
     * @param scene 当前场景对象
     * @param callback 回调函数
     * @param once 仅触发一次
     */
    public static addCameraCallback(scene: Scene, callback: any, once?: boolean);
	
##### 移除Camera回调

	/**
     * 移除Camera回调
     * @param scene 当前场景对象
     * @param callback 回调函数
     */
    public static removeCameraCallback(scene: Scene, callback: any);
	
##### 开启/关闭相机物理碰撞

	/**
     * 开启/关闭相机物理碰撞
     * @param scene 场景对象
     * @param isEnabled 是否开启
     */
    public static setCollisionsEnabled(scene: Scene, isEnabled: boolean = true);
	
#### **注释设置**

##### 创建注释

    /**
     * 创建注释
     * @param scene 场景对象
     * @param name 注释名字
     * @param tickFunc 每帧回调
     * @param disposeFunc 销毁回调, 可以留空为默认
     * @param showOnLoad 加载后立刻显示(默认为true)
     * @returns 返回新建注释的id
     */
    public static createAnnotation(scene: Scene, name: string, tickFunc: AnnotationTick, disposeFunc?: AnnotationDispose, showOnLoad = true)
	
##### 批量创建Html注释, 并在其中添加html模板

    /**
     * 批量创建Html注释, 并在其中添加html模板
     * @param scene 场景对象
     * @param idProp id字段
     * @param htmlTemplate html模板(支持{{大胡子表达式}})
     * @param prefix 注释名字前缀
     * @param bindMap 数据绑定关系
     * @param attachedDataArray 注释数据
     * @param parentNode html的父节点. 默认为canvas.parentNode
     * @param shiftXInPixel X偏移, 单位为像素
     * @param shiftYInPixel Y偏移, 单位为像素
     * @param showOnLoad 加载后直接显示(默认为true)
     * @returns 返回新建注释列表
     */
    public static createAnnotationWithHtmlTemplate(
        scene: Scene, idProp: string, prefix: string, htmlTemplate: string, bindMap: string,
        attachedDataArray: any[], parentNode = "", shiftXInPixel = 0, shiftYInPixel = 0,
        showOnLoad = true
    );
	
##### 设置注释是否可见

    /**
     * 设置注释是否可见
     * @param scene 场景对象
     * @param prefix 注释名字前缀
     * @param idProp id字段
     * @param attachedData 注释数据
     * @param visibility 是否可见
     */
    public static setAnnotationVisibility(scene: Scene, prefix: string, idProp: string, attachedData: any, visibility: boolean);
	
	
##### 通过名称销毁注释

    /**
     * 通过名称销毁注释
     * @param scene 场景对象
     * @param name 注释名称
     * @returns 销毁注释数量
     */
    public static destroyAnnotationsByName(scene: Scene, name: string): number;
	
##### 通过Id销毁注释

    /**
     * 通过Id销毁注释
     * @param scene 场景对象
     * @param name 注释ID
     * @returns 成功返回true, 失败返回false
     */
    public static destroyAnnotationByID(scene: Scene, id: string);
	
##### 销毁所有指定前缀的注释

	/**
     * 销毁所有指定前缀的注释
     * @param scene 场景对象
     * @param prefix 注释名字前缀
     */
    public static destroyAnnotationsByPrefix(scene: Scene, prefix: string);
	
#### **撒点设置**

##### 初始化撒点

	/**
     * 初始化撒点
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param parent 父节点id
     * @param categoryIcons 图标信息
     * @param callback 执行完成后回调
     * @param poiTapCallback 点击回调
     * @param poiMouseEnterCallback 鼠标进入回调
     * @param poiMouseLeaveCallback 鼠标移出回调
     */
    public static createPoiSystem(scene: Scene, id: string, parent: string, categoryIcons: any[], callback: any, poiTapCallback: any, poiMouseEnterCallback: any, poiMouseLeaveCallback: any);
	
##### 批量添加点位

	/**
     * 批量添加点位
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param datas 数据Array
     * @param bindMap 绑定关系
     */
    public static createPois(scene: Scene, id: string, scale: number, datas: any[], bindMap: string);
	
##### 清除点位

	/**
     * 清除点位
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param rebuild 是否更新显示
     */
    public static clearPois(scene: Scene, id: string, rebuild: boolean = true);
	
##### 刷新点位显示

	/**
     * 刷新点位显示
     * @param scene 场景对象
     * @param id 撒点系统编号
     */
    public static buildPois(scene: Scene, id: string);
	
##### 初始化撒点，添加点位数据并刷新

	/**
     * 初始化撒点，添加点位数据并刷新
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param parent 父节点id
     * @param category 图标类型
     * @param scale 缩放
     * @param datas 数据
     * @param bindMap 绑定关系
     * @param poiTapCallback 点击回调
     * @param poiMouseEnterCallback 鼠标进入回调
     * @param poiMouseLeaveCallback 鼠标移出回调
     */
    public static createPoiAndBuild(scene: Scene, id: string, parent: string, category: any[], scale: number,
                                    datas: any[], bindMap: string,
                                    poiTapCallback: any, poiMouseEnterCallback: any, poiMouseLeaveCallback: any);
	
##### 注册撒点回调

	/**
     * 注册撒点回调
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param listeners 回调
     * {
     *     onLoad(poi, wvp, visibility)
     *     onBuilded(poi, wvp, visibility)
     *     onPointClick(poi, point, wvp, pointerInfo)
     *     onPositionChanged(poi, wvp)
     *     onVisibilityChanged(poi, visibility)
     *     onDisposed(poi)
     * }
     */
    public static registerPoiListeners(scene: Scene, id: string, listeners: any);
	
##### 反注册撒点回调

	/**
     * 反注册撒点回调
     * @param scene 场景对象
     * @param id 撒点系统编号
     * @param listeners 回调
     * {
     *     onLoad(poi, wvp, visibility)
     *     onBuilded(poi, wvp, visibility)
     *     onPointClick(poi, point, wvp, pointerInfo)
     *     onPositionChanged(poi, wvp)
     *     onVisibilityChanged(poi, visibility)
     *     onDisposed(poi)
     * }
     */
    public static unRegisterPoiListeners(scene: Scene, id: string, listeners: any);
	
#### **点击事件**

##### 注册点击回调

	/**
     * 注册点击回调
     * @param scene 场景对象
     * @param id interaction编号
     * @param listeners 回调
     * {
     *     onLoad(poi, wvp, visibility)
     *     onBuilt(poi, wvp, visibility)
     *     onTap(poi, point, wvp, pointerInfo)
     *     onDoubleTap(poi, point, wvp, pointerInfo)
     *     onDown(poi, point, wvp, pointerInfo)
     *     onUp(poi, point, wvp, pointerInfo)
     *     onMove(poi, point, wvp, pointerInfo)
     *     onEnter(poi, point, wvp, pointerInfo)
     *     onLeave(poi, point, wvp, pointerInfo)
     *     onPositionChanged(poi, wvp)
     *     onVisibilityChanged(poi, visibility)
     *     onDisposed(poi)
     * }
     */
    public static registerClickListeners(scene: Scene, id: string, listeners: any);
	
##### 反注册点击回调

	/**
     * 反注册点击回调
     * @param scene 场景对象
     * @param id interaction编号
     * @param listeners 回调
     */
    public static unRegisterClickListeners(scene: Scene, id: string, listeners: any);

#### **热力图设置**

##### 创建热力图

	/**
     * 创建热力图
     * @param scene 场景对象
     * @param id 热力图系统编号
     * @param parent 父节点id
     */
    public static createHeatmap(scene: Scene, id: string, parent: string);
	
##### 设置热力图数据

	/**
     * 设置热力图数据
     * @param scene 场景对象
     * @param id 热力图系统编号
     * @param datas 数据Array
     * @param bindMap 绑定关系
     */
    public static updateHeatmap(scene: Scene, id: string, datas: any[], bindMap: string);
	
##### 清除热力图数据

	/**
     * 清除热力图数据
     * @param scene 场景对象
     * @param id 热力图系统编号
     */
    public static clearHeatmap(scene: Scene, id: string);

#### **场景设置**

##### 设置背景颜色

	/**
     * 设置背景颜色
     * @param scene 场景对象
     * @param color 颜色
     * @param alpha 透明度
     */
    public static setClearColor(scene: Scene, color: string, alpha?: number);
	
##### 设置雾

	/**
     * 设置雾
     * @param scene 场景对象
     * @param {Object} params 参数
     *  fogEnabled:{Boolean} 开启
     *  fogColor:{String} 颜色
     *  fogAlpha:{Number} 透明度
     *  fogStart:{Number} 起始距离
     *  fogEnd:{Number} 结束距离
     *  fogAmount:{Number} 强度
     */
    public static setFog(scene: Scene, params: any);
	
##### 设置重力

	/**
     * 设置重力
     * @param scene 场景对象
     * @param gravity 重力
     */
    public static setGravity(scene: Scene, gravity: any);
	
##### 设置背景图片

	/**
     * 设置背景图片
     * @param scene 当前场景对象
     * @param url: 图片url
     * @param keepAspect: 保持宽高比
     * @param scale: 图片缩放
     */
    public static setBackgroundImage(scene: Scene, url?: string, keepAspect?: boolean, scale?: number);
	
##### 获取背景图片参数

    /**
     * 获取背景图片参数
     * @param scene 当前场景对象
     * @return {url, keepAspect, scale}
     * url: 图片url
     * keepAspect: 保持宽高比
     * scale: 图片缩放
     */
    public static getBackgroundImage(scene: Scene);
	
##### 设置前景图片

	/**
     * 设置前景图片
     * @param scene 当前场景对象
     * @param url: 图片url
     * @param keepAspect: 保持宽高比
     * @param scale: 图片缩放
     */
    public static setForegroundImage(scene: Scene, url?: string, keepAspect?: boolean, scale?: number);
	
##### 获取前景图片参数

	/**
     * 获取前景图片参数
     * @param scene 当前场景对象
     * @return {url, keepAspect, scale}
     * url: 图片url
     * keepAspect: 保持宽高比
     * scale: 图片缩放
     */
    public static getForegroundImage(scene: Scene);
	
##### 设置地图参数

	/**
     * 设置地图参数
     * @param scene 场景对象
     * @param {Object} params 地图参数
     *  latOffset:{String} 维度中心
     *  lngOffset:{Boolean} 经度中心
     *  scaling:{Number} 缩放
     *  plottingScale:{Number} 比例尺
     */
    public static setMapParams(scene: Scene, params: any);

#### **容器**

##### 获取容器列表

    /**
     * 获取容器列表
     * @param scene 场景对象
     * @return {[{name,id}]}
     *  name:{String} 名称
     *  id:{String} 编号
     */
    public static getContainers(scene: Scene);
	
##### 获取容器状态和数据列表

	/**
     * 获取容器状态和数据列表
     * @param scene 场景对象
     * @param containerId 容器ID
     * @return {[{name,group,type,key,value,states}]}
     *  name:{String} 容器名称
     *  group:{String} 分组
     *  type:{String} 类型
     *  key:{String} 键
     *  value:{Object} 值
     *  states:{{name,stateId}} 状态列表
     */
    public static getContainerDataList(scene: Scene, containerId: string);
	
##### 设置容器状态和数据

	/**
     * 设置容器状态和数据
     * @param scene 场景对象
     * @param containerId 容器ID
     * @param values {{key:value}} 参数
     *  key:{String} 键
     *  value:{Object} 值/状态
     */
    public static setContainerData(scene: Scene, containerId: string, values: any);

#### **后期**

##### 创建后期效果

	/**
     * 创建后期效果
     * @param scene 场景对象
     * @param type 后期类型
     * @param options 数据
     */
    public static createPostProcess(scene: Scene, type: string, options?: any);
	
##### 按名字获取场景中的节点

	/**
     * 设置后期效果参数
     * @param scene 场景对象
     * @param type 后期类型
     * @param options 数据
     */
    public static setPostProcessParams(scene: Scene, type: string, options: any);
	
##### 销毁后期效果

	/**
     * 销毁后期效果
     * @param scene 场景对象
     * @param type 后期类型
     */
    public static disposePostProcess(scene: Scene, type: string);
	
##### 开启/关闭后期效果

	/**
     * 开启/关闭后期效果
     * @param scene 场景对象
     * @param type 后期类型
     * @param isEnabled 是否开启
     */
    public static setPostProcessEnabled(scene: Scene, type: string, isEnabled: boolean = true);

##### 设置色彩平衡

	/**
     * 设置色彩平衡
     * @param scene 场景对象
     * @param {Object} params 参数
     *  amount:{Number} 强度
     *  hue:{Number} 色相
     *  saturation:{Number} 饱和度
     *  lift:{Number} 亮度
     *  gain:{Number} 增益
     *  offset:{Number} 偏移
     */
    public static setColorBalance(scene: Scene, params: any);
	
#### **设置镜面反射**

##### 设置镜面反射参数

	/**
     * 设置镜面反射参数
     * @param scene 场景对象
     * @param params 参数
     */
    public static setMirrorParams(scene: Scene, params: any);
	
#### **高亮设置**

##### 创建物体高亮层

	/**
     * 创建物体高亮层
     * @param scene 场景对象
     * @param options 选项
     * @param color 颜色
     */
    public static createHighlightLayer(scene: Scene, options?: any, color?: string);
	
##### 销毁物体高亮层

	/**
     * 销毁物体高亮层
     * @param scene 场景对象
     */
    public static disposeHighlightLayer(scene: Scene, options?: any, color?: string);
	
##### 设置物体高亮

	/**
     * 设置物体高亮
     * @param scene 场景对象
     * @param nodeId 节点IDArray
     * @param color 颜色
     */
    public static setNodeHighlight(scene: Scene, nodeId?: string[], color?: string);
	
##### 清空高亮层

	/**
     * 清空高亮层
     * @param scene 场景对象
     */
    public static clearHighlight(scene: Scene);

#### **场景加载/卸载**

##### 叠加场景

	/**
     * 叠加场景(加载另外一个场景中的内容到当前场景中)
     * @param scene 当前场景对象
     * @param sceneId 新场景id
     * @param rootUrl 新场景根url
     * @param sceneFileName 新场景文件名
     * @param fadeInTimeInSeconds 淡入场景的动画时长
     * @param onSuccess 加载成功回调
     * @param onProgress 加载过程回调
     * @param onError 加载失败回调
     */
    public static appendScene(
        scene: Scene, sceneManager: SceneManager, sceneId: string, rootUrl: string, sceneFileName: string,
        fadeInTimeInSeconds: number,
        onSuccess: Nullable<SceneLoadSuccessCallback>,
        onProgress: Nullable<SceneLoadProgressCallback>,
        onError: Nullable<SceneLoadErrorCallback>
    );
	
##### 切换场景

	/**
     * 切换场景
     * @param scene 场景对象
     * @param sceneIdToShow 新场景ID, 只能是一个. 要继续加载其他场景, 请参考appendScene.
     * @param rootUrl 新场景根url
     * @param sceneFileName 新场景文件名
     * @param fadeOutTimeInSeconds 淡入场景的动画时长
     * @param fadeInTimeInSeconds 淡入场景的动画时长
     * @param onSuccess 加载成功回调
     * @param onProgress 加载过程回调
     * @param onError 加载失败回调
     */
    public static switchScene(
        scene: Scene, sceneManager: SceneManager, sceneIdToShow: string,
        rootUrl: string, sceneFileName: string, fadeOutTimeInSeconds: number, fadeInTimeInSeconds: number,
        onSuccess: Nullable<SceneLoadSuccessCallback>,
        onProgress: Nullable<SceneLoadProgressCallback>,
        onError: Nullable<SceneLoadErrorCallback>
    );
	
##### 卸载场景

	/**
     * 卸载场景
     * @param scene 场景对象
     * @param sceneId 场景id
     * @param fadeTimeInSeconds 淡出动画时长
     * @param callback 卸载结束后回调
     */
    public static unloadScene(
        scene: Scene, sceneManager: SceneManager, sceneId: string, fadeTimeInSeconds: number,
        callback: Nullable<SceneActionCallback>
    );

#### **参数动画**

##### 获取参数动画参数

	/**
     * 获取参数动画参数
     * @param scene 当前场景对象
     * @param moverId Mover对象id
     */
    public static getMoverParams(scene: Scene, moverId: string);
	
##### 设置参数动画参数

	/**
     * 设置参数动画参数
     * @param scene 当前场景对象
     * @param moverId Mover对象Id
     * @param params 参数
     *  enable:{String} 使能
     *  active:{Object} 激活
     *  pause:{Object} 暂停
     *  swing:{Object} 往复
     *  min:{Object} 起始值
     *  max:{Object} 结束值
     *  base:{Object} 基础值
     *  duration:{Object} 时长
     *  delay:{Object} 延迟启动
     *  offset:{Object} 时基偏移
     *  easing:{Object} 函数类型
     */
    public static setMoverParams(scene: Scene, moverId: string, params: any);
	
##### 添加参数动画回调

	/**
     * 添加参数动画回调
     * @param scene 当前场景对象
     * @param moverId Mover对象Id
     * @param callback 回调函数
     * @param once 仅触发一次
     */
    public static addMoverCallback(scene: Scene, moverId: string, callback: any, once?: boolean);
	
##### 移除参数动画回调

	/**
     * 移除参数动画回调
     * @param scene 当前场景对象
     * @param moverId Mover对象Id
     * @param callback 回调函数
     */
    public static removeMoverCallback(scene: Scene, moverId: string, callback: any);

#### **状态动画**

##### 播放状态动画

	/**
     * 播放状态动画
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param state 状态
     */
    public static playStateAnimation(scene: Scene, animId: string, state: string);
	
##### 跳转状态动画

	/**
     * 跳转状态动画
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param state 状态
     */
    public static jumpStateAnimation(scene: Scene, animId: string, state: string);
	
##### 播放状态动画到下一个状态

	/**
     * 播放状态动画到下一个状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param revert 反方向
     */
    public static playStateAnimationToNextState(scene: Scene, animId: string, mode?: boolean | string);
	
##### 获取状态动画的目标状态

	/**
     * 获取状态动画的目标状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     */
    public static getStateAnimationCurrState(scene: Scene, animId: string);
	
##### 播放状态动画

	/**
     * 播放状态动画
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param progress 进度
     * @param duration 耗时
     */
    public static playStateAnimationToProgress(scene: Scene, animId: string, progress: number, duration?: number);
	
##### 添加状态动画回调

	/**
     * 添加状态动画回调
     * @param scene 当前场景对象
     * @param animId 动画ID
     * @param callback 回调函数
     * @param once 仅触发一次
     */
    public static addStateAnimationCallback(scene: Scene, animId: string, callback: any, once?: boolean);
	
##### 移除状态动画回调

	/**
     * 移除状态动画回调
     * @param scene 当前场景对象
     * @param animId 动画ID
     * @param callback 回调函数
     */
    public static removeStateAnimationCallback(scene: Scene, animId: string, callback: any)

#### **关键帧动画**

##### 播放关键帧动画

	/**
     * 播放关键帧动画
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param params 参数
     *  speed:{Number} 速度
     *  mode:{Number} 模式
     */
    public static playKeyframeAnimation(scene: Scene, animId: string, params: any);
	
##### 暂停关键帧动画

	/**
     * 暂停关键帧动画
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param state 状态
     */
    public static pauseKeyframeAnimation(scene: Scene, animId: string);
	
##### 播放关键帧动画到状态

	/**
     * 播放关键帧动画到状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param state 状态
     */
    public static playKeyframeAnimationToState(scene: Scene, animId: string, state: string);
	
##### 跳转关键帧动画到状态

	/**
     * 跳转关键帧动画到状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param state 状态
     */
    public static jumpKeyframeAnimationToState(scene: Scene, animId: string, state: string);
	
##### 播放关键帧动画到下一个状态

	/**
     * 播放关键帧动画到下一个状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param mode 模式, 0:正向, 1:反向, random:随机
     */
    public static playKeyframeAnimationToNextState(scene: Scene, animId: string, mode?: boolean | string);
	
##### 获取关键帧动画的播放时间

	/**
     * 获取关键帧动画的播放时间
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     */
    public static getKeyframeAnimationPlayingTime(scene: Scene, animId: string);
	
##### 获取关键帧动画的目标时间

    /**
     * 获取关键帧动画的目标时间
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @returns playingTime 播放时间
     */
    public static getKeyframeAnimationCurrTime(scene: Scene, animId: string): number;
	
##### 获取关键帧动画的目标状态

    /**
     * 获取关键帧动画的目标状态
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @returns stateId 状态id或undefined
     */
    public static getKeyframeAnimationCurrState(scene: Scene, animId: string): number;
	
##### 播放关键帧动画到时间

	/**
     * 播放关键帧动画到时间
     * @param scene 当前场景对象
     * @param animId Animation对象Id
     * @param time 时间
     */
    public static playKeyframeAnimationToTime(scene: Scene, animId: string, time: number);
	
##### 添加关键帧动画回调

	/**
     * 添加关键帧动画回调
     * @param scene 当前场景对象
     * @param animId 动画ID
     * @param callback 回调函数
     * @param once 仅触发一次
     */
    public static addKeyframeAnimationCallback(scene: Scene, animId: string, callback: any, once?: boolean);
	
##### 移除关键帧动画回调

	/**
     * 移除关键帧动画回调
     * @param scene 当前场景对象
     * @param animId 动画ID
     * @param callback 回调函数
     */
    public static removeKeyframeAnimationCallback(scene: Scene, animId: string, callback: any);
	
#### **更新geoJson数据**

##### 更新GeoJson数据

	/**
     * 更新GeoJson数据
     * @param scene 当前场景对象
     * @param keyword 过滤关键字
     * @param options 参数
     * @param geoDatas GeoJson数据
     * @callback 数据转换回调函数
     */
    public static updateMeshByGeoJson(scene: Scene, keyword: string,
                                      options: { clockwiseCheck: boolean,
                                          autoCenter: boolean,
                                          autoScale: boolean,
                                          scaleText: boolean,
                                          scaling: number,
                                          parentId: string,
                                          controlId: string,
                                          convert: (point: number[]) => number[] },
                                      geoDatas: any,
                                      callback: (feature: any) => { id: string,
                                          name: string,
                                          height: number,
                                          cloneMesh: boolean,
                                          cloneMaterial: boolean,
                                          subMesh: boolean,
                                          material: string | Material,
                                          info: any, text: { text: string,
                                              rotationY: number,
                                              scaling: number,
                                              x: number,
                                              y: number,
                                              z: number },
                                          buildTop: boolean,
                                          buildSide: boolean,
                                          buildScan: boolean,
                                          adjustUV: boolean }[]);

#### **使用地图位置转换**

##### 经纬度转为空间坐标

	/**
     * 经纬度转为空间坐标
     * @param lng 维度
     * @param lat 经度
     * @return {x, y}
     *  x:{Number}
     *  y:{Number}
     */
	 
    scene.mapTools.lnglat2xy(lng: number, lat: number);

##### 空间坐标转为经纬度

	/**
     * 经纬度转为空间坐标
     * @param x
     * @param y
     * @return {lng, lat}
     *  lng:{Number} 维度
     *  lat:{Number} 经度
     */
	 
    scene.mapTools.xy2lnglat(x: number, y: number);


### **场景Api**

#### **获取节点**

##### 通过名字获取节点：

	/**
	* 通过名称获取节点
	**/
	scene.getNodeByName('节点名称');
	
##### 通过ID获取节点：

	/**
	* 通过ID获取节点
	**/
	scene.getNodeByID('node id');
	
##### 获取子节点：

	/**
	* 获取子节点
	**/
	node.childrenNode; //null | node[]
	
##### 通过KPath获取节点（列表）：

	/**
	* 通过路径获取节点
	**/
	scene.getNodeByPath('path', rootNode);
	
	/**
	* 通过路径获取节点列表
	**/
	scene.getNodeListByPath('path', rootNode);

KPath是场景下根据路径查找节点的方式
rootNode可以为任何树节点，如果为空则查找场景中的所有节点

各级约束通过斜杠分割"/"
KPath支持类型、名称、序列、关键词四种过滤方式，后三种过滤方式需要写在中括号内，也可以通过空格隔开，设置多个过滤（多个过滤条件为且）
- 类型："/TransformNode"、 "/Mesh"
- 名称："/[#name]"、 "/[#Test]"；名称不能包含空格、斜杠、中括号、#&等符号
- 序列："/[0]"、"/[1]"
- 关键词："[&geoJson]"、"[&Title]"

```javascript
//场景下第一个叫“root”的节点
scene.getNodeByPath("/[#root]")；

//场景下第一个叫“root”的轴节点
scene.getNodeByPath("/TransformNode[#root]")；

//场景下第一个叫“root”的节点后的所有模型
scene.getNodeByPath("/[#root]/Mesh")；

//root节点下所有坐标轴节点
scene.getNodeListByPath("/TransformNode", root)；

//root节点下第三个坐标轴节点
scene.getNodeListByPath("/TransformNode[3]", root)；

//root节点下第三个叫“测试”坐标轴节点
scene.getNodeListByPath("/TransformNode[#测试 3]", root)；

//场景中所有关键词包含"geoJson"的节点
scene.getNodeListByPath("/[&geoJson]", root)；
```

#### **获取材质**

##### 通过名称获取材质

	/**
	* 通过名称获取材质
	**/
	scene.getMaterialByName('材质名称');

##### 通过ID获取材质

	/**
	* 通过ID获取材质
	**/
	scene.getMaterialByID('材质id');

#### **获取样条**

##### 通过名称获取样条

	/**
	* 通过名称获取材质
	**/
	scene.getSplineGroupByName('样条名称');

##### 通过ID获取样条

	/**
	* 通过ID获取样条
	**/
	scene.getSplineGroupByID('样条id');

#### **相机控制**

##### 获取场景当前相机

	/**
	* 获取场景当前相机
	**/
	scene.activeCamera;

##### 获取机位参数

	/**
	* 获取机位
	* @name 名称
	* @return 机位
	*  id ID
	*  name: 名称
	*  isDefault： 默认
	*  yaw: 偏航角（弧度）
	*  pitch: 俯仰角（弧度）
	*  roll: 翻滚角（弧度）
	*  distance: 距离
	*  target: 目标
	*  fov: 视角（弧度）
	*  projectOffset: 画面偏移
	*  useModulo： 启用取模插值
	*  enableLimit： 启用限制
	*  lowerDistanceLimit： 限制最近距离
	*  upperDistanceLimit： 限制最远距离
	*  lowerYawLimit： 限制最小偏航角（弧度）
	*  upperYawLimit： 限制最大偏航角（弧度）
	*  lowerPitchLimit： 限制最小俯仰角（弧度）
	*  upperPitchLimit： 限制最大俯仰角（弧度）
	*  lowerTargetLimit： 限制目标空间最小值
	*  upperTargetLimit： 限制目标空间最大值
	*  useModulo： 启用取模插值
	*  autoRotate: 自动旋转
	*  rotateDuration: 自动旋转时长
	*  invertRotate: 逆向自动旋转
	**/
	scene.getCameraArgsByName('顶视角');
	
##### 获取相机的机位参数

	/**
	* 获取相机的实时机位参数
	**/
	camera.args;

##### 聚焦相机

	/**
	* 聚焦相机到机位
     * @param args 机位参数，或机位ID/名称
     * @param duration 时间
     */
	camera.focusOn(args：OrbitCameraArgs | string, duration = 1);
	
	/**
	* 聚焦相机到物体，缩放到物体包围盒对角线长度等于屏幕纵向尺寸乘以ratio
     * @param objects 节点/节点列表、Vector3/Vector3列表
     * @param duration 时间
     * @param focusArgs 参数
     *  ratio:{number} 聚焦缩放比例，默认0.9
     *  minDistance:{number} 最近距离
     *  maxDistance:{number} 最远距离
     */
	camera.focusOnObject(objects: Node[] | Node, duration?: number, focusArgs?: {ratio: number, minDistance?: number, maxDistance?: number});


##### 复位相机到默认机位

	/**
	* 复位相机到默认机位
     * @param duration 时间
     */
	camera.resetToDefault(duration: number = this.duration);

##### 获取当前相机及机位参数

	//获取相机
	let camera = scene.activeCamera；

	//获取当前相机机位参数
	let args = camera.args；

	//设置机位的相机距离
	let args.distance = 10;

	//当前相机控制
	camera.focusOn(args, 0.8);

##### 通过ID获取材质

	/**
	* 通过ID获取材质
	**/
	scene.getMaterialByID('material id');

### **示例**

##### 通过脚本设置模型材质，并更新文字内容：

	//找到表示商铺A的模型
	let meshArea = scene.getMeshByName("商铺A");
	//找到商铺A对应需要显示状态的2D文字节点
	let meshLabel = scene.getMeshByName("文字-商铺A");
	//找到已出租的材质样式
	let material0 = scene.getMaterialByName('已出租');
	
	//设置商铺A的模型为已出租的样式
	meshArea.material = material0;
	//设置文字为“已出租”
	meshLabel.text = '已出租';

##### 聚焦到物体/位置

聚焦到物体

	// 使用puzzleApi聚焦到物体
	puzzle.focusCameraOnObject(scene, '0tllNQ5y4Ye3CfPDGJoEm', 0.8);
	// 使用场景Api聚焦到物体
	let camera = scene.activeCamera;
	let obj = scene.getNodeByID('0tllNQ5y4Ye3CfPDGJoEm');
	camera.focusOnObject(obj, 0.8);

聚焦到位置

	// 获取场景相机
	let camera = scene.activeCamera;
	// 聚焦到世界坐标点Vector3(5, 0, 7)
	camera.focusOnObject(new Kingfisher.Vector3(5, 0, 7), 0.8);

	// 聚焦到节点的本地坐标点Vector3(5, 0, 7)
	let position = new Kingfisher.Vector3(5, 0, 7);
	// 获取节点
	let node = scene.getNodeByName('节点.1');
	// 获取转换矩阵，如果能够确定当前节点及其所有父节点坐标都没有做更改，可以不传true来节省性能。
	let world = node.computeWorldMatrix(true);
	// 位置转换
	let newPosition = Kingfisher.Vector3.TransformCoordinates(position, world);
	camera.focusOnObject(newPosition, 0.8);
	

点击聚焦到点位

	const pickInfoIconCallback = (args0, picked) => {
		let infoPoint = picked.pickInfo.infoPoint;
		if (infoPoint) {
			// 获取场景相机
			let camera = scene.activeCamera;
			// 获取点位位置
			let position = infoPoint.position;
			// 获取点位节点
			let node = scene.getNodeByName('点位.1');
			// 获取转换矩阵，如果能够确定当前节点及其所有父节点坐标都没有做更改，可以不传true来节省性能。
			let world = node.computeWorldMatrix(true);
			// 位置转换
			let newPosition = Kingfisher.Vector3.TransformCoordinates(position, world);
			camera.focusOnObject(newPosition, 0.8);
		}
	}

##### 通过脚本更新点位数据

1. 场景树中添加点位节点
![](/uploads/platform/images/m_c0430c73e8db25b9794a705eb18022f2_r.png)

1. 确保您的场景内容已经添加所需要的点位
![](/uploads/platform/images/m_efb6eaa8b92ef405dcea13da164d9165_r.png)

方法1，使用场景Api实现
```javascript
// 方法1，使用场景Api实现
let node = scene.getNodeByName('点位');
console.log(node);
let points = [];

for (let i = 0; i < 100; i++) {
	let p = new Kingfisher.InfoPoint();
	p.position.x = (Math.random() - 0.5) * 30;
	p.position.y = (Math.random() - 0.5) * 1;
	p.position.z = (Math.random() - 0.5) * 30;

	p.category = '园区';//点位类别
	p.type ="门禁";
	p.status ="正常";
	points.push(p);
}

node.points = points;
node.build();
```

方法2，使用puzzleApi实现
```javascript
// 方法2，使用puzzleApi实现
/**初始化撒点
	* @param scene 场景对象
	* @param id 撒点系统编号
	* @param parent 父节点id
	* @param category 图标类型，可以为空
	* @param scale 缩放
	* @param datas 数据
	* @param bindMap 绑定关系
	* @param poiTapCallback 点击回调
	* @param poiMouseEnterCallback 鼠标进入回调
	* @param poiMouseLeaveCallback 鼠标移出回调
	**/
puzzle.createPoiAddBuild(scene, "点位节点名字", null, null, 1, [{
		x: 0,//位置x
		y: 0,//位置y，对应三维空间的z
		// lat: 31.0,//维度
		// lng: 103.0,//经度
		height: 9,//高度，对应三维空间的
		scale: 1,//缩放
		category: '园区',//点位类别
		type:"门禁",
		status:"正常",
	}], null, (p) => {
	console.log('点击', p);
});
```

##### 通过脚本飞线

1. 场景中添加连线节点
![](/uploads/platform/images/m_6f8536d3044c72bf4a7e3d05e6292d9e_r.png)
1. 调整连线样式和方式
点击连线节点后在右侧模型设置中
设置连线半径：0.05，设置样式：弧线，设置连线方式：一对多。
![](/uploads/platform/images/m_8f2df66169ce83f16da6d7115b429e59_r.png)
1. 添加扫光效果材质
![](/uploads/platform/images/m_cb20c7d3a420ebe96439e85c8491e329_r.png)
1. 添加脚本逻辑

		// 找到连线节点
        let node = scene.getNodeByName('连线');
        let geometryBuilder = node.geometryBuilder;

        // 清除以前的数据
        geometryBuilder.points = [];

        // 设置起点
        geometryBuilder.points.push(new Kingfisher.Vector3());
        // 循环创建20个随机点
        for (let i = 0; i < 20; i ++) {
            let p = new Kingfisher.Vector3(Math.random() * 20  -10, 0, Math.random() * 20  -10);
            geometryBuilder.points.push(p);
        }

        // 更新到模型
        geometryBuilder.build();

##### 通过脚本更新样条

1. 场景中添加样条节点（样条、样条位置、样条机位）
![](/uploads/platform/images/m_ff871906d015e5c853aab123878a0fe6_r.png) ![](/uploads/platform/images/m_1fbd6185a8d150fc3cefc3ffebc45ca0_r.png)

1. 在场景内容>样条中可以看到新建的样条数据
![](/uploads/platform/images/m_4754f3bd8930bb13c50dcd1974ed9a40_r.png)

1. 点击样条列表中的第一个，右键，转为路径。可以根据实际需要调整相关参数
![](/uploads/platform/images/m_8c56b7f09bbecf839472429e9c90817e_r.png)

		// 找到样条数据
        let splineGroup = scene.getSplineGroupByName('样条名称');
        let spline = splineGroup.splines[0];

        // 清除以前的数据
        spline.points = [];

        // 设置起点
        spline.points.push(new Kingfisher.Vector3());
        // 循环创建20个随机点
        for (let i = 0; i < 20; i ++) {
            let p = new Kingfisher.Vector3(Math.random() * 20  -10, 0, Math.random() * 20  -10);
            spline.points.push(p);
        }

        // 更新
        spline.makeDirty();
		
		
### Diagram3d组件

此组件用于加载展示在翠鸟三维组态/翠鸟工创中制作的三维系统图场景, 并使用SDK的库进行交互操作.

##### 属性
| 属性  | 类型  | 必须  | 描述  |
| ------------ | ------------ | ------------ | ------------ |
|  sceneUrl | String  | 是  | 场景ID, 格式为<项目Id>/<场景ID>.k3ds, 例如 1234/5678.k3ds |
| logo  |  String |  否 | 自定义加载图标URL, 可以是相对URL, 也可以是绝对URL, 默认空 |
| logoSize  |  String |  否 | 加载图标尺寸, 格式为<width>,<height>, 例如480,320, 默认空  |
| showStats  |  Boolean | 否  | 是否显示帧率统计, 默认否  |

##### 事件
| 事件  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  sceneLoad | 对象, scene属性为当前场景对象 | 场景加载完成后触发 |
|  loadingHide | 对象, scene属性为当前场景对象 | 场景加载Logo消失后触发 |
|  tap | 对象, pointerInfo属性为点击信息对象 | 点击场景后触发 |
|  render | 对象, engine属性引擎对象, sceneManager属性为场景管理器对象, scene属性为当前场景对象 | 场景每一帧时触发 |

##### 方法
| 方法  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  getDiagram3dManager | diagram3d组件实例 | 获取管理器对象实例, KingfisherUI.getDiagram3dManager(diagram3d) |

### 管理器

#### 添加组件点击监听

##### addEventListener 组件加入监听，会返回一个Object对象，当移除组件监听的时候需要使用这个对象

```
/**
* @description 获取组件数据 获取数据值
* @param {Object} scene 场景对象
* @param {String} partId 组件id或名称
* @param {Function} callBack 回调函数
* @param {Boolean} force 强制 //对于组件中没有默认开启交互的模型，强制启用交互
* @return {Object} value 数据值
*
* */
addEventListener(Scene, partId, callBack, force);
```

##### 删除组件点击监听

```
/**
* @description 删除组件监听
* @param {Object} scene 场景对象
* @param {String} partId 组件id或名称
* @param {Object} observable 申请监听时返回对象
*
* */
removeEventListener(Scene, partId,  observable);
```

#### 添加鼠标事件监听

##### addMouseEventListeners 组件加入监听，会返回一个Object对象，当移除组件监听的时候需要使用这个对象

```
/**
* @description 获取组件数据 获取数据值
* @param {Object} scene 场景对象
* @param {String} partId 组件id或名称
* @param {Object} callBacks 回调函数 //需要的事件加上回调就可以，onMove/onEnter/onLeave会额外自动开启移动监测
*  onTap: {Function} 鼠标单击回调
*  onDoubleTap: {Function} 鼠标双击回调
*  onDown: {Function} 鼠标按下回调
*  onUp: {Function} 鼠标抬起回调
*  onMove: {Function} 鼠标移动回调
*  onEnter: {Function} 鼠标进入回调
*  onLeave: {Function} 鼠标离开回调
* @param {Boolean} force 强制 //对于组件中没有默认开启交互的模型，强制启用交互
* @return {Object} observers 回调注册
*
* */
addMouseEventListeners(Scene, partId, callBacks, force);
```

##### 删除鼠标事件监听

```
/**
* @description 删除组件监听
* @param {Object} scene 场景对象
* @param {String} partId 组件id或名称
* @param {Object} observables 申请监听时返回对象
*
* */
removeMouseEventListeners(Scene, partId,  observable);
```

#### 获取组件数据列表

##### getDataListByPart 获取组件数据列表

```javascript
/**
 * @description 获取组件数据列表 数据对象数组
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @return {partId,name,value,group,type}[] 数据对象列表
 *   partId:{ String } 组件Id <br/>
 *   name:{ String } 数据名称 <br/>
 *   group:{ String } 数据组名称 <br/>
 *   type:{ String:['Boolean'|'String'|'Number'|'Color3'...] } 数据类型 <br/>
 *   key: {String} 数据key
 * */
getDataListByPart(scene, partId);
```

#### 获取设备组件简要信息

##### getDevicePartsBriefInfo 获取设备组件简要信息

```javascript
/**
 * @description 获取设备组件简要信息
 * @param {Object} scene 场景对象
 * @return {Object[]} 组件数组
 * */
getDevicePartsBriefInfo(scene);
```

#### 获取场景分组信息

##### getGroups 获取场景分组信息

```javascript
    /**
 * @description 获取场景分组信息
 * @return {groups,ungroup} groups：分组列表信息，ungroup：未分组组件
 * */
getGroups(scene);
```

#### 获取场景分组简要信息

##### getGroupsBriefInfo 获取场景分组简要信息

```javascript
/**
 * @description 获取场景分组简要信息
 * @return {groups,ungroup} groups：分组列表信息，ungroup：未分组组件
 * */
getGroupsBriefInfo(scene);
```

#### 获取场景组件简要信息

##### getMiscPartsBriefInfo 获取场景辅助信息组件简要信息

```javascript
/**
 * @description 获取场景辅助信息组件简要信息
 * @param {Object} scene 场景对象
 * @return {Object[]} 组件数组
 * */
getMiscPartsBriefInfo(scene);
```

#### 根据关键字获取组件信息

##### getPartBriefInfoArrayByKeywords 根据关键字获取组件信息

```javascript

/**
 * @description 根据组件Id获取组件简要信息
 * @param {Object} scene 场景对象
 * @param {String | String[]} keywords 关键字
 * @return {[{partId,name,attribute,category,resourceName,groupName,groupId}]}
 *  partIdName:{ String } 组件Id <br/>
 *  name:{ String } 组件名称 <br/>
 *  [attribute]:{ String } 组件大的分类 <br/>
 *  [category]:{ String } 组件小的分类 <br/>
 *  [resourceName]:{ String } 组件资源名称 <br/>
 *  [groupName]:{ String } 组件分组名称 <br/>
 *  [groupId]:{ String } 组件分组id <br/>
 *  */
getPartBriefInfoArrayByKeywords(scene, keywords);
```

#### 根据组件Id获取组件简要信息

##### getPartBriefInfoByPartId 获取场景内组件

```javascript
/**
 * @description 根据组件Id获取组件简要信息
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @return {partId,name,attribute,category,resourceName,groupName,groupId}
 *  partId:{ String } 组件Id <br/>
 *  name:{ String } 组件名称 <br/>
 *  [attribute]:{ String } 组件大的分类 <br/>
 *  [category]:{ String } 组件小的分类 <br/>
 *  [resourceName]:{ String } 组件资源名称 <br/>
 *  [groupName]:{ String } 组件分组名称 <br/>
 *  [groupId]:{ String } 组件分组id <br/>
 *  */
getPartBriefInfoByPartId(scene,partId);
```

#### 获取组件数据

##### getPartData 获取组件数据列表

```javascript
/**
 * @description 获取组件数据列表 Key-Value键值对
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @return {Object} values 数据值
 *
 * */
getPartData(scene, partId);
```

#### 获取组件数据

##### getPartDataByKey 获取组件数据

```javascript
/**
 * @description 获取组件数据 获取数据值
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @param {String} key 数据key
 * @return {Object} value 数据值
 *
 * */
getPartDataByKey(scene, partId,key);
```

#### 获取场景中所有组件的简要信息列表

##### getPartsBriefInfo 获取场景中所有组件的简要信息列表

```javascript
/**
 * @description 获取场景中所有组件的简要信息列表
 * @param {Object} scene 场景对象
 * @return {partId,name,attribute,category,resourceName,groupName,groupId}[] 组件数组
 *  partId:{ String } 组件Id <br/>
 *  name:{ String } 组件名称 <br/>
 *  [attribute]:{ String } 组件大的分类 <br/>
 *  [category]:{ String } 组件小的分类 <br/>
 *  [resourceName]:{ String } 组件资源名称 <br/>
 *  [groupName]:{ String } 组件分组名称 <br/>
 *  [groupId]:{ String } 组件分组id <br/>
 *  */
getPartsBriefInfo(scene);
```

#### 获取分组内组件列表

##### getPartsByGroup 获取分组内组件列表

```javascript
/**
 * @description 获取分组内组件列表
 * @param {Object} group 分组对象
 * @return {Object[]} 组件列表
 * */
getPartsByGroup(group);
```

#### 获取管线组件简要信息

##### getPipelinePartsBriefInfo 获取管线组件简要信息

```javascript
/**
 * @description 获取管线组件简要信息
 * @param {Object} scene 场景对象
 * @return {Object[]} 组件数组
 * */
getPipelinePartsBriefInfo(scene);
```

#### 设置组件数据

##### setPartData 设置组件数据

```javascript
/**
 * @description 设置组件数据
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @param {Object} value 数据值
 *
 * */
setPartData(scene, partId,value);
```

#### 设置组件数据

##### setPartDataByKey 设置组件数据

```javascript
/**
 * @description 设置组件数据
 * @param {Object} scene 场景对象
 * @param {String} partId 组件id
 * @param {String} key 数据key
 * @param {Object} value 数据值
 *
 * */
setPartDataByKey(scene, partId, key, value);
```

#### 获取场景面板信息

##### getPanelsInfo 获取场景内组件

```javascript
/**
 * @function getPanelsInfo
 * @description 获取场景所有面板信息
 *  key:绑定对象的key
 *  panels:面板列表
 *  id:面板id
 *  label:面板名称
 *  items:面板配置项
 * **/
getPanelsInfo(scene,partId);
```

#### 根据组件id获取面板信息

##### getPanelsInfoByPartId 根据组件id获取面板信息

```javascript
/**
 * @function getPanelsInfoByPartId
 * @description 根据组件id获取面板信息
 *  key:绑定对象的key
 *  panels:面板列表
 *  id:面板id
 *  label:面板名称
 *  items:面板配置项
 * **/
getPanelsInfoByPartId(scene,partId);
```

#### 隐藏面板

##### hidePanel 隐藏面板

```javascript
/**
 * @function hidePanel
 * @description 隐藏面板
 * **/
hidePanel(scene,partId);
```

#### 批量设置面板数据

##### setPanelData 设置单独面板一组数据，会根据数据对象的key对面板进行赋值

```javascript
/**
 * @function setPanelData
 * @description 设置单独面板一组数据，会根据数据对象的key对面板进行赋值 <br/>
 *  注意事项: key会优先匹配标签文本，例如key如果是2，那么会优先匹配标签文本是2的配置项<br/>
 *  在配置项不存在时，会寻找配置项列表中第三个配置项进行赋值（数据索引是从0开始的，所以2对应数据列表中第三个配置项 <br/>，
 *  数据列表中存在第三个配置项时，对配置项进行赋值）
 * @return void
 * **/
setPanelData(scene,partId);
```

#### 获取场景面板信息

##### setPanelDataByKey 设置面板配置项值

```javascript
/**
 * @description 设置面板配置项值
 * **/
setPanelDataByKey(scene,partId);
```

#### 显示面板

##### showPanel 显示面板

```javascript
/**
 * @function showPanel
 * @description 显示面板
 * **/
showPanel(scene,partId);
```

#### 切换面板显隐

##### togglePanel 切换面板显隐

```javascript
/**
 * @function togglePanel
 * @description 切换面板显隐
 * **/
togglePanel(scene,partId);
```

### Space3d组件

此组件用于加载展示在翠鸟空间治理工具中维护的空间数据, 并使用SDK的库进行交互操作.

##### 属性
| 属性  | 类型  | 必须  | 描述  |
| ------------ | ------------ | ------------ | ------------ |
|  projectId | String  | 是  | 项目Id |
| buildingId  |  String |  是 | 建筑编码 |
| buildingName  |  String |  是 | 建筑名称 |
| floorId  |  String |  是 | 楼层编码 |
| floorName  |  String |  是 | 楼层名称 |
| partType  |  Array |  是 | 显示部件列表 |
| showToolBar  |  Boolean |  否 | 显示工具栏, 默认否 |
| showViewBar  |  Boolean |  否 | 显示状态栏, ,默认否 |
| logo  |  String |  否 | 自定义加载图标URL, 可以是相对URL, 也可以是绝对URL, 默认空 |
| logoSize  |  String |  否 | 加载图标尺寸, 格式为<width>,<height>, 例如480,320, 默认空  |
| showStats  |  Boolean | 否  | 是否显示帧率统计, 默认否  |

##### 模型类型
| 类型  | 描述 |
| ------------ | ------------ |
|  wall | 墙  |
|  area | 区域  |
|  model.door | 门  |
|  model.window | 窗  |
|  model.camera | 监控  |
|  model.sensor | 传感器  |
|  model.light | 灯  |
|  model.desk | 桌  |
|  model.chair | 椅  |
|  model.equipment | 设备  |
| model.parking | 停车  |

##### 事件
| 事件  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  sceneLoad | 对象, scene属性为当前场景对象 | 场景加载完成后触发 |
|  loadingHide | 对象, scene属性为当前场景对象 | 场景加载Logo消失后触发 |
|  tap | 对象, pointerInfo属性为点击信息对象 | 点击场景后触发 |
|  render | 对象, engine属性引擎对象, sceneManager属性为场景管理器对象, scene属性为当前场景对象 | 场景每一帧时触发 |

##### 方法
| 方法  | 参数 | 描述  |
| ------------ | ------------ | ------------ |
|  getSpace3dManager | space3d组件实例 | 获取管理器对象实例, KingfisherUI.getSpace3dManager(space3d) |

### 管理器

##### 设置机位模式
```
/**
* 设置机位
* @param mode 机位模式, 0为透视模式, 1为顶视模式
*/
resetCamera(mode: number): void;
```

##### 选择模型
```
/**
* 选择模型
* @param objects 模型列表
*/
selectObjects(objects: string[]): void;
```

##### 选择楼层
```
/**
* 设置楼层
* @param floor 楼层对象
*/
setFloor(floor: object): void;
```

##### 选择大楼
```
/**
* 设置建筑
* @param building 建筑对象
*/
```

##### 搜索
```
/**
* 搜索部件
* @param keyword 搜索条件
*/
search(keyword: string): void;
```