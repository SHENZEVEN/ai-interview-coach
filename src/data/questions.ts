import { QuestionCategory } from '../types';

export const questionsData: QuestionCategory[] = [
  {
    name: '前端',
    questions: [
      {
        id: 'fe-1',
        text: '解释一下什么是虚拟DOM，以及它的工作原理',
        keyPoints: ['虚拟DOM是真实DOM的JavaScript对象表示', '状态变化时创建新虚拟DOM树', 'diff算法对比新旧虚拟DOM', '最小化真实DOM操作'],
        referenceAnswer: '虚拟DOM是真实DOM的轻量级JavaScript表示。状态变更时，对比新旧虚拟DOM找出最小更新集，再批量应用到真实DOM，减少重排重绘，提升性能。'
      },
      {
        id: 'fe-2',
        text: 'CSS盒模型是什么？content-box和border-box有什么区别？',
        keyPoints: ['内容区域+内边距+边框+外边距', 'content-box宽度包含内容区域', 'border-box宽度包含边框和内边距', 'border-box更符合直觉'],
        referenceAnswer: 'CSS盒模型描述元素空间组成。content-box的width/height仅含内容，border-box含内容+内边距+边框。border-box计算更方便。'
      },
      {
        id: 'fe-3',
        text: '什么是跨域资源共享(CORS)？如何解决跨域问题？',
        keyPoints: ['浏览器同源策略限制', 'CORS通过响应头授权', 'Access-Control-Allow-Origin头', 'JSONP/WebSocket/代理等方式'],
        referenceAnswer: 'CORS是浏览器安全机制，允许服务端通过特定响应头（如Access-Control-Allow-Origin）授权跨域请求。也可使用JSONP或后端代理绕过。'
      },
      {
        id: 'fe-4',
        text: '解释JavaScript中的事件循环(Event Loop)机制',
        keyPoints: ['调用栈执行同步代码', '任务队列存储异步任务', '微任务队列优先级高于宏任务', 'setTimeout/setInterval属宏任务，Promise属微任务'],
        referenceAnswer: '事件循环持续从调用栈取任务执行，同步代码直接执行，异步代码完成时进入任务队列。微任务（如Promise回调）优先于宏任务（如setTimeout）执行。'
      },
      {
        id: 'fe-5',
        text: 'React中的useEffect依赖数组你理解吗？',
        keyPoints: ['空数组只在首次渲染执行', '有依赖时首次及依赖变化时执行', '无依赖数组每次渲染后都执行', '可选返回清理函数'],
        referenceAnswer: 'useEffect的依赖数组控制执行时机。空数组仅挂载时执行一次；有依赖时首次及依赖变化时执行；无数组则每次渲染后执行。可返回函数清理副作用。'
      },
      {
        id: 'fe-6',
        text: '什么是TypeScript的泛型？有什么作用？',
        keyPoints: ['类型作为参数的抽象', '增加代码复用性', '保持类型安全', '常见于函数、接口、类'],
        referenceAnswer: '泛型允许定义时使用类型占位符，使用时再指定具体类型。既能复用逻辑，又能确保类型安全。如Array<T>可存放任意类型元素。'
      },
      {
        id: 'fe-7',
        text: '解释HTTP缓存机制，强制缓存和协商缓存的区别',
        keyPoints: ['强制缓存Cache-Control/Expires', '协商缓存Last-Modified/ETag', '强制缓存不请求服务器', '协商缓存需服务器验证'],
        referenceAnswer: '强制缓存由Cache-Control或Expires控制，在有效期内直接使用缓存。协商缓存通过Last-Modified或ETag验证资源是否更新，需服务器确认。'
      },
      {
        id: 'fe-8',
        text: '什么是前端模块化？CommonJS、ES Module、AMD的区别？',
        keyPoints: ['模块化提高代码组织性', 'CommonJS是同步加载（Node.js）', 'ES Module是静态导入编译时检查', 'AMD是异步加载（RequireJS）'],
        referenceAnswer: '模块化将代码拆分为独立模块。CommonJS使用require/module.exports，适合Node.js同步加载。ES Module使用import/export，编译时处理。AMD使用define/require，异步加载。'
      },
      {
        id: 'fe-9',
        text: '说说对React Fiber架构的理解',
        keyPoints: ['将渲染任务拆分为小单元', '可中断可恢复', '优先级调度更新', '通过reconciler实现'],
        referenceAnswer: 'Fiber是React 16引入的协调引擎，将渲染工作拆分为微小单元，可中断恢复执行。支持优先级调度，让高优先级更新（如用户输入）打断低优先级更新，提升用户体验。'
      },
      {
        id: 'fe-10',
        text: '如何优化React应用的性能？',
        keyPoints: ['React.memo/useMemo/useCallback', '懒加载React.lazy', '虚拟列表', '减少不必要的重渲染'],
        referenceAnswer: '优化手段包括：用React.memo/useMemo/useCallback避免不必要渲染；用React.lazy做代码分割懒加载；虚拟列表优化长列表；Keys稳定且避免index作为key。'
      },
      {
        id: 'fe-11',
        text: '解释浏览器的重排(Reflow)和重绘(Repaint)',
        keyPoints: ['重排是元素几何属性改变', '重绘是外观改变但布局不变', '重排必定触发重绘', '批量操作减少重排'],
        referenceAnswer: '重排是元素位置、尺寸等几何属性变化；重绘是颜色等视觉样式变化但不影响布局。重排开销更大，会触发重绘。批量DOM操作、使用transform/opacity可优化性能。'
      },
      {
        id: 'fe-12',
        text: '什么是WebSocket？与HTTP的区别？',
        keyPoints: ['WebSocket是全双工通信', 'HTTP是请求-响应模式', 'WebSocket建立后可持续通信', 'WebSocket使用ws://或wss://协议'],
        referenceAnswer: 'WebSocket是持久化全双工通信协议，建立连接后可双向实时传输数据。HTTP是半双工，每次通信需重新建立请求。WebSocket适合实时聊天、推送等场景。'
      },
      {
        id: 'fe-13',
        text: 'CSS Flexbox和Grid布局有什么区别？',
        keyPoints: ['Flexbox是一维布局', 'Grid是二维布局', 'Flexbox适合行或列', 'Grid适合整体页面布局'],
        referenceAnswer: 'Flexbox是单轴布局，适合处理一行或一列元素的对齐和分布。Grid是双轴布局，能同时控制行和列，更适合复杂页面整体布局。'
      },
      {
        id: 'fe-14',
        text: '什么是闭包？有什么应用场景？',
        keyPoints: ['函数能访问外部变量', '形成私有作用域', '防抖节流', '模块化'],
        referenceAnswer: '闭包是函数能访问其词法作用域外部变量的能力。应用场景包括：防抖节流函数、模块化私有变量、缓存计算结果等。'
      },
      {
        id: 'fe-15',
        text: '解释CSS的BEM命名规范',
        keyPoints: ['Block块、Element元素、Modifier修饰符', '格式：block__element--modifier', '避免样式冲突', '提高代码可维护性'],
        referenceAnswer: 'BEM是一种CSS命名方法论。Block是独立组件，Element是组件的子部分，Modifier是状态或变体。格式为block__element--modifier，如button__text--primary。'
      },
      {
        id: 'fe-16',
        text: 'React中的state和props有什么区别？',
        keyPoints: ['props是父组件传入', 'state是组件内部管理', 'props不可变', 'state可变但应使用setState'],
        referenceAnswer: 'props是从父组件传入的属性，用于组件间通信，不可修改。state是组件内部状态，用于管理自身数据，可通过setState修改，修改会触发重新渲染。'
      },
      {
        id: 'fe-17',
        text: '什么是箭头函数与普通函数的区别？',
        keyPoints: ['箭头函数没有自己的this', '箭头函数不能作为构造函数', '箭头函数没有arguments', '箭头函数语法更简洁'],
        referenceAnswer: '箭头函数主要区别：没有自己的this继承外层；不能用作构造函数；没有arguments对象；语法更简洁。适合回调函数。'
      },
      {
        id: 'fe-18',
        text: '如何实现一个防抖函数？',
        keyPoints: ['延迟执行', '每次触发重置计时器', '可设置延迟时间', '可支持立即执行'],
        referenceAnswer: '防抖函数在事件触发n秒后执行，n秒内再次触发则重置计时器。基本实现：用一个setTimeout，事件触发时clear并重新设置。'
      },
      {
        id: 'fe-19',
        text: '解释async/await与Promise的关系',
        keyPoints: ['async函数返回Promise', 'await等待Promise resolved', '使异步代码更同步化', '错误处理用try/catch'],
        referenceAnswer: 'async函数自动返回Promise。await等待Promise结果并阻塞函数执行。async/await是Promise的语法糖，让异步代码看起来像同步代码，错误用try/catch捕获。'
      },
      {
        id: 'fe-20',
        text: '浏览器的存储方式有哪些？区别是什么？',
        keyPoints: ['localStorage持久存储', 'sessionStorage会话级存储', 'cookie随请求发送', ' IndexedDB客户端数据库'],
        referenceAnswer: 'localStorage持久存储约5MB；sessionStorage会话结束清除；cookie约4KB且随请求发送；IndexedDB是大型结构化数据存储。'
      }
    ]
  },
  {
    name: '计网',
    questions: [
      {
        id: 'nw-1',
        text: 'TCP和UDP的区别是什么？',
        keyPoints: ['TCP面向连接可靠', 'UDP无连接不可靠', 'TCP有拥塞控制', 'UDP效率更高'],
        referenceAnswer: 'TCP提供面向连接、可靠传输，有拥塞控制和流量控制，适用于文件传输、邮件等。UDP无连接、快速但不可靠，适用于实时音视频、直播等。'
      },
      {
        id: 'nw-2',
        text: '三次握手和四次挥手的过程',
        keyPoints: ['三次握手：SYN，SYN-ACK，ACK', '四次挥手：FIN，ACK，FIN，ACK', '防止历史连接初始化', '确保双方都能发送和接收'],
        referenceAnswer: '三次握手建立连接：客户端发SYN，服务器回SYN-ACK，客户端再发ACK。四次挥手断开连接：主动方发FIN，被动方回ACK，被动方发FIN，主动方回ACK。'
      },
      {
        id: 'nw-3',
        text: 'HTTP和HTTPS的区别？HTTPS如何加密？',
        keyPoints: ['HTTPS = HTTP + TLS', 'HTTPS使用证书验证身份', '对称加密传输数据', '非对称加密交换密钥'],
        referenceAnswer: 'HTTPS在HTTP基础上加入TLS/SSL加密。服务器需证书验证身份。加密过程：先用非对称加密交换对称密钥，再用对称加密传输数据，兼顾安全与效率。'
      },
      {
        id: 'nw-4',
        text: '什么是DNS？DNS的解析过程？',
        keyPoints: ['域名解析为IP地址', '递归查询和迭代查询', '浏览器缓存->系统缓存->本地域名服务器', '本地域名服务器逐级查询'],
        referenceAnswer: 'DNS将域名解析为IP。流程：浏览器缓存->系统缓存->本地域名服务器->根域名服务器->顶级域名服务器->权威域名服务器，逐级查询返回IP。'
      },
      {
        id: 'nw-5',
        text: '输入URL到页面加载完成的过程？',
        keyPoints: ['DNS解析', 'TCP连接', 'HTTP请求/响应', '浏览器渲染'],
        referenceAnswer: '过程：DNS解析IP -> TCP三次握手建立连接 -> 浏览器发送HTTP请求 -> 服务器处理返回HTML -> 浏览器解析HTML -> 请求静态资源 -> 渲染页面。'
      },
      {
        id: 'nw-6',
        text: 'HTTP状态码有哪些？常见的状态码含义？',
        keyPoints: ['2xx成功', '3xx重定向', '4xx客户端错误', '5xx服务器错误'],
        referenceAnswer: '常见状态码：200成功，301/302永久/临时重定向，304缓存，400参数错误，401未授权，403禁止访问，404未找到，500服务器错误，502/504网关错误。'
      },
      {
        id: 'nw-7',
        text: 'Cookie、Session、Token的区别？',
        keyPoints: ['Cookie存储在浏览器', 'Session存在服务器', 'Token是无状态的JWT', 'Cookie配合Session或存Token'],
        referenceAnswer: 'Cookie是浏览器存储的小数据；Session是服务端会话存储用户信息；Token（如JWT）是包含用户信息的加密字符串，可自验证。Session依赖Cookie存SessionID。'
      },
      {
        id: 'nw-8',
        text: '什么是CDN？CDN的工作原理？',
        keyPoints: ['内容分发网络', '就近获取资源', '缓存静态资源', '减轻源站压力'],
        referenceAnswer: 'CDN是内容分发网络，在各地部署边缘节点服务器。用户访问时，DNS解析到最近节点，直接从节点返回缓存的静态资源，加速访问并减轻源站压力。'
      },
      {
        id: 'nw-9',
        text: 'TCP的流量控制和拥塞控制？',
        keyPoints: ['流量控制防止发送过快', '滑动窗口机制', '拥塞控制防止网络过载', '慢启动、拥塞避免、快速恢复'],
        referenceAnswer: '流量控制通过滑动窗口确保接收方来得及处理。拥塞控制防止网络过载，包括慢启动（指数增长）、拥塞避免（线性增长）、快速恢复等算法。'
      },
      {
        id: 'nw-10',
        text: 'WebSocket的连接过程？',
        keyPoints: ['基于HTTP协议升级', '发送Upgrade头', '服务器返回101状态码', '成功后切换协议'],
        referenceAnswer: 'WebSocket通过HTTP协议升级建立。客户端发送带Upgrade头的请求，服务端返回101状态码表示协议切换，之后连接升级为WebSocket全双工通信。'
      },
      {
        id: 'nw-11',
        text: 'HTTP/1.0、HTTP/1.1、HTTP/2的区别？',
        keyPoints: ['1.0无连接，1.1keep-alive', '1.1支持管道化', '2.0多路复用', '2.0头部压缩、服务器推送'],
        referenceAnswer: 'HTTP/1.0无连接。HTTP/1.1支持长连接和管道化但串行处理。HTTP/2.0多路复用可并行传输，头部压缩减少体积，支持服务器推送。'
      },
      {
        id: 'nw-12',
        text: '什么是正向代理和反向代理？',
        keyPoints: ['正向代理代理客户端', '反向代理代理服务端', '正向代理隐藏客户端', '反向代理隐藏服务端、负载均衡'],
        referenceAnswer: '正向代理位于客户端，代替客户端访问服务器，隐藏真实客户端（如VPN）。反向代理位于服务端，隐藏真实服务器，提供负载均衡、缓存等功能（如Nginx）。'
      },
      {
        id: 'nw-13',
        text: 'TCP的四次挥手为什么需要TIME_WAIT状态？',
        keyPoints: ['确保被动方收到最后的ACK', '防止旧连接的延迟数据包被新连接接收', '等待2MSL时间', '让TCP可靠关闭'],
        referenceAnswer: 'TIME_WAIT状态持续2MSL（最大报文生存时间），确保被动关闭方收到最后的ACK，或等待本连接的所有数据包消失，防止影响后续新连接。'
      },
      {
        id: 'nw-14',
        text: 'HTTPS的TLS握手过程？',
        keyPoints: ['客户端发送支持的加密套件', '服务器选择并发送证书', '客户端验证证书并生成会话密钥', '双方用会话密钥加密通信'],
        referenceAnswer: 'TLS握手：客户端发支持的加密算法列表 -> 服务器选算法发证书 -> 客户端验证证书生成随机数并用公钥加密 -> 服务器解密，双方用随机数生成会话密钥加密通信。'
      },
      {
        id: 'nw-15',
        text: '什么是ARP协议？',
        keyPoints: ['地址解析协议', 'IP地址到MAC地址', '局域网内广播请求', '缓存IP-MAC映射'],
        referenceAnswer: 'ARP协议将IP地址解析为MAC地址。当主机需要发送数据时，先查本地ARP表，无则广播ARP请求，目标主机回应其MAC地址，存入ARP缓存。'
      },
      {
        id: 'nw-16',
        text: '浏览器请求并发限制是多少？如何突破？',
        keyPoints: ['同域名一般6个', 'HTTP/1.1的队头阻塞', '域名分片', '升级到HTTP/2多路复用'],
        referenceAnswer: 'HTTP/1.1同域名一般最多6个并发连接。可通过域名分片（多域名）突破，或升级到HTTP/2利用多路复用并行传输。'
      },
      {
        id: 'nw-17',
        text: '什么是跨域？如何解决跨域问题？',
        keyPoints: ['同源策略限制', 'CORS跨域资源共享', 'JSONP只支持GET', '代理服务器转发'],
        referenceAnswer: '跨域是浏览器同源策略限制不同源的资源访问。解决方案：CORS（服务端设置Access-Control-Allow-Origin）；JSONP（利用script标签不受限但仅GET）；代理转发。'
      },
      {
        id: 'nw-18',
        text: 'TCP的可靠传输如何保证？',
        keyPoints: ['校验和检测错误', '序号和确认应答', '超时重传', '流量控制'],
        referenceAnswer: 'TCP可靠传输通过：校验和检测传输错误、序号确保数据顺序、确认应答(ACK)机制确认收到、超时重传未确认数据、滑动窗口进行流量控制。'
      },
      {
        id: 'nw-19',
        text: '什么是RESTful API？',
        keyPoints: ['表现层状态转移', '使用HTTP方法语义', 'GET/POST/PUT/DELETE对应查增改删', '无状态设计'],
        referenceAnswer: 'RESTful是API设计规范，使用HTTP方法表达操作语义：GET查、POST增、PUT/PATCH改、DELETE删。URL表示资源，服务器无状态设计，利用HTTP协议特性。'
      },
      {
        id: 'nw-20',
        text: 'DHCP协议的工作过程？',
        keyPoints: ['客户端广播DHCP Discover', '服务器响应DHCP Offer', '客户端广播DHCP Request', '服务器确认DHCP ACK'],
        referenceAnswer: 'DHCP动态分配IP：客户端广播Discover寻找服务器 -> 服务器发Offer提供IP -> 客户端广播Request请求该IP -> 服务器发ACK确认，正式分配IP。'
      }
    ]
  },
  {
    name: '算法',
    questions: [
      {
        id: 'algo-1',
        text: '请实现一个数组去重函数',
        keyPoints: ['Set去重', 'Map记录出现次数', '时间复杂度', '空间复杂度'],
        referenceAnswer: '使用Set最简洁：const unique = (arr) => [...new Set(arr)]。或使用Map记录元素出现次数，遍历构建新数组。时间复杂度O(n)，空间复杂度O(n)。'
      },
      {
        id: 'algo-2',
        text: '什么是时间复杂度和空间复杂度？如何表示？',
        keyPoints: ['算法执行效率', '大O表示法', '常见复杂度O(1)/O(logn)/O(n)/O(nlogn)/O(n²)', '空间复杂度指额外空间'],
        referenceAnswer: '时间复杂度是算法执行时间与输入规模的关系，用大O表示。常见：O(1)常数、O(logn)对数、O(n)线性、O(nlogn)线性对数、O(n²)平方。空间复杂度指额外空间需求。'
      },
      {
        id: 'algo-3',
        text: '请用JavaScript实现一个深拷贝函数',
        keyPoints: ['处理基本类型和引用类型', '处理数组和对象', '处理循环引用', '处理Date/RegExp等特殊对象'],
        referenceAnswer: '深拷贝需递归复制对象。基础版本处理基本类型、数组、对象即可。完善版本需处理循环引用（用WeakMap记录已拷贝对象）和Date、RegExp、函数等特殊类型。'
      },
      {
        id: 'algo-4',
        text: '快速排序的原理是什么？时间复杂度是多少？',
        keyPoints: ['分治思想', '选择基准元素', '分区操作', '递归排序子数组'],
        referenceAnswer: '快速排序选择基准元素，将数组分为两部分：小于基准和大于基准，递归排序子数组。平均时间复杂度O(nlogn)，最坏O(n²)。空间复杂度O(logn)。'
      },
      {
        id: 'algo-5',
        text: '什么是归并排序？它与快速排序的区别？',
        keyPoints: ['分治、自顶向下', '先分割再合并', '稳定排序', '需要额外空间'],
        referenceAnswer: '归并排序采用分治，先分割数组到最小单位，再逐步合并排序。稳定排序，时间复杂度稳定O(nlogn)，但需要O(n)额外空间。快排不稳定但空间O(1)。'
      },
      {
        id: 'algo-6',
        text: '请实现一个防抖函数',
        keyPoints: ['延迟执行', '清除上一个定时器', '立即执行可选', '返回取消函数'],
        referenceAnswer: '防抖原理：事件触发时，清除上一个setTimeout，重新设置新定时器，n秒内不再次触发才执行。可选立即执行模式。返回取消函数用于清理。'
      },
      {
        id: 'algo-7',
        text: '请实现一个节流函数',
        keyPoints: ['固定时间间隔执行', '使用时间戳或定时器', '首次是否立即执行', '结束是否执行一次'],
        referenceAnswer: '节流原理：限制函数执行频率。使用时间戳记录上次执行时间，间隔内不再执行；或使用定时器，执行后重置。常见模式有首次立即执行、结束时再执行一次。'
      },
      {
        id: 'algo-8',
        text: '什么是二叉树？如何遍历二叉树？',
        keyPoints: ['每个节点最多两个子节点', '前序/中序/后序遍历', '层序遍历', '递归和迭代实现'],
        referenceAnswer: '二叉树是每个节点最多两个子节点的数据结构。遍历方式：前序（根-左-右）、中序（左-根-右）、后序（左-右-根）、层序（逐层）。可递归或用栈/队列迭代实现。'
      },
      {
        id: 'algo-9',
        text: '什么是动态规划？适用场景？',
        keyPoints: ['最优子结构', '重叠子问题', '状态转移方程', '自底向上计算'],
        referenceAnswer: '动态规划通过分解问题、保存子问题结果避免重复计算。适用于具有最优子结构和重叠子问题的问题。如爬楼梯、背包问题、最长公共子序列等。'
      },
      {
        id: 'algo-10',
        text: '请实现一个珂珂吃香蕉函数',
        keyPoints: ['二分查找', '单调性判断', '速度与时间关系', '边界条件处理'],
        referenceAnswer: '珂珂吃香蕉问题是经典二分查找问题。速度与完成时间成反比，单调递减。二分查找最小速度，使在H小时内吃完所有香蕉。关键：正确判断能否吃完、调整搜索边界。'
      },
      {
        id: 'algo-11',
        text: '什么是贪心算法？与动态规划的区别？',
        keyPoints: ['局部最优解', '不回溯', '简单高效', '不一定全局最优'],
        referenceAnswer: '贪心算法每步选择当前最优解，不回溯。简单高效，但不一定得到全局最优。动态规划保存子问题结果，考虑全局最优。适用于贪心选择性质的问题。'
      },
      {
        id: 'algo-12',
        text: '请实现一个数组扁平化函数',
        keyPoints: ['flat方法', 'reduce+递归', '展开运算符', 'Infinity深度'],
        referenceAnswer: '数组扁平化：arr.flat(Infinity)直接；或reduce累加：arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flat(val) : val), [])；或递归遍历处理。'
      },
      {
        id: 'algo-13',
        text: '什么是哈希表？哈希冲突如何解决？',
        keyPoints: ['键值对存储', '哈希函数映射', '链地址法', '开放寻址法'],
        referenceAnswer: '哈希表通过哈希函数将键映射到数组索引，实现O(1)查找。冲突解决：链地址法（相同哈希值用链表存储）、开放寻址法（线性探测、二次探测、再哈希）。'
      },
      {
        id: 'algo-14',
        text: '请实现一个合并两个有序数组的函数',
        keyPoints: ['双指针', '从后往前合并', '避免额外空间', '处理边界情况'],
        referenceAnswer: '合并有序数组：从后往前双指针比较，避免移动元素。i指向nums1有效数据尾部，j指向nums2尾部，k指向放置位置，从大到小填充。'
      },
      {
        id: 'algo-15',
        text: '什么是堆？什么是栈？区别？',
        keyPoints: ['堆是完全二叉树', '栈是先进后出', '堆用于优先队列', '栈用于函数调用'],
        referenceAnswer: '堆是用数组实现的完全二叉树，分为最大堆和最小堆，常用于优先队列。栈是先进后出数据结构，用于函数调用、表达式求值。堆空间由程序分配，栈空间有限。'
      },
      {
        id: 'algo-16',
        text: '请实现一个快速幂函数',
        keyPoints: ['指数折半', '底数平方', '二进制思想', 'O(logn)复杂度'],
        referenceAnswer: '快速幂利用指数的二进制表示。当指数为偶数，a^n = (a²)^(n/2)；为奇数，a^n = a * (a²)^(n/2)。递归或迭代实现，时间复杂度O(logn)。'
      },
      {
        id: 'algo-17',
        text: '什么是回溯算法？适用场景？',
        keyPoints: ['搜索解空间', '穷举尝试', '撤销选择', '八皇后、排列组合'],
        referenceAnswer: '回溯是深度优先搜索解空间，通过穷举尝试找满足条件的解。发现当前选择不符合条件时，撤销选择回退。适用于八皇后、排列组合、子集等问题。'
      },
      {
        id: 'algo-18',
        text: '请实现一个LRU缓存',
        keyPoints: ['哈希表+双向链表', 'O(1)操作', '最近使用移至头部', '超出容量删除尾部'],
        referenceAnswer: 'LRU用哈希表存键值对，双向链表维护顺序。get时将节点移到头部，put时添加到头部，超容量时删除尾部节点。两者都是O(1)时间复杂度。'
      },
      {
        id: 'algo-19',
        text: '什么是单调栈？适用场景？',
        keyPoints: ['栈内元素单调', '递增或递减', '下一个更大元素', '柱状图最大矩形'],
        referenceAnswer: '单调栈是元素单调递增或递减的栈。适用场景：找每个元素下一个更大/更小元素、计算柱状图最大矩形面积、去除多余括号等。遍历时维护单调性。'
      },
      {
        id: 'algo-20',
        text: '请实现一个字符串全排列函数',
        keyPoints: ['回溯算法', '交换元素', '去重处理', '递归终止条件'],
        referenceAnswer: '字符串全排列用回溯：固定一个字符，递归排列剩余字符。交换元素实现路径选择，用used数组或set去重。递归终止条件是路径长度等于字符串长度。'
      }
    ]
  },
  {
    name: 'AI Coding',
    questions: [
      // 1. Prompt工程与输出控制
      {
        id: 'ai-prompt-1',
        text: '如何设计Prompt让AI稳定输出JSON格式？',
        keyPoints: ['JSON格式指令', '格式约束', 'Schema定义', '错误处理'],
        referenceAnswer: '在Prompt中明确指定输出格式为JSON，提供JSON Schema示例，使用<json></json>标签包裹，设置low temperature(0.1-0.3)确保确定性，并用JSON.parse校验输出。'
      },
      {
        id: 'ai-prompt-2',
        text: 'System Prompt与User Prompt的分工是什么？',
        keyPoints: ['角色定义', '行为约束', '任务说明', '上下文设定'],
        referenceAnswer: 'System Prompt用于定义角色、设定规则、提供背景知识，保持不变。User Prompt用于具体任务描述和当前查询。这种分离提高可维护性和复用性。'
      },
      {
        id: 'ai-prompt-3',
        text: 'Few-shot与Zero-shot如何选择？各有什么优缺点？',
        keyPoints: ['示例数量', '数据需求', '模型性能', '适用场景'],
        referenceAnswer: 'Zero-shot无需示例，适合通用任务但精度较低。Few-shot提供3-5个示例，显著提升特定任务效果，但需要标注数据。复杂任务建议用Few-shot。'
      },
      {
        id: 'ai-prompt-4',
        text: '如何防止AI输出多余解释或Markdown包裹？',
        keyPoints: ['指令明确', '格式约束', '输出示例', 'temperature设置'],
        referenceAnswer: '在Prompt结尾添加"直接输出结果，不要解释"，提供纯文本输出示例，设置low temperature，使用输出格式约束如"仅返回数字"。'
      },
      // 2. 上下文管理与长文本处理
      {
        id: 'ai-context-1',
        text: '什么是上下文窗口？如何处理超出窗口限制的情况？',
        keyPoints: ['Token限制', '滑动窗口', '摘要压缩', 'RAG集成'],
        referenceAnswer: '上下文窗口是模型能处理的最大Token数。超出时可采用：滑动窗口保留最新内容、摘要压缩历史、RAG检索相关片段、分块处理再聚合。'
      },
      {
        id: 'ai-context-2',
        text: '如何估算Token数量并进行成本控制？',
        keyPoints: ['Token计算', 'API费用模型', '缓存策略', '按需请求'],
        referenceAnswer: '使用tiktoken库计算Token，设置最大输入输出长度限制，实现请求缓存避免重复调用，使用流式响应减少不必要的计算。'
      },
      {
        id: 'ai-context-3',
        text: '多轮对话中如何管理记忆？',
        keyPoints: ['短期记忆', '长期记忆', '记忆检索', '遗忘机制'],
        referenceAnswer: '短期记忆用对话历史，长期记忆存储到向量数据库。检索相关记忆注入当前上下文，设置记忆过期时间或基于相关性遗忘。'
      },
      // 3. AI API集成与工程落地
      {
        id: 'ai-api-1',
        text: 'AI API调用如何处理超时和限流？',
        keyPoints: ['超时设置', '重试机制', '熔断降级', '流量控制'],
        referenceAnswer: '设置合理超时时间(10-30秒)，实现指数退避重试，接入熔断器防止雪崩，使用令牌桶限制调用频率。'
      },
      {
        id: 'ai-api-2',
        text: '流式响应(SSE/WebSocket)有什么好处？如何实现？',
        keyPoints: ['实时反馈', '减少等待', '内存优化', '实现方式'],
        referenceAnswer: '流式响应逐块返回结果，用户体验更好，减少服务器内存压力。使用SSE或WebSocket，客户端监听message事件实时渲染。'
      },
      {
        id: 'ai-api-3',
        text: '如何安全管理API Key？',
        keyPoints: ['环境变量', '密钥管理服务', '访问控制', '定期轮换'],
        referenceAnswer: '将API Key存储在环境变量而非代码中，使用Vault等密钥管理服务，限制API Key权限范围，定期轮换密钥。'
      },
      {
        id: 'ai-api-4',
        text: 'AI API调用有哪些缓存策略？',
        keyPoints: ['请求缓存', '响应缓存', '语义缓存', '时间过期'],
        referenceAnswer: '缓存相同请求的响应，使用Redis存储，设置合理过期时间。语义缓存可匹配相似请求，减少重复调用。'
      },
      // 4. RAG与知识库
      {
        id: 'ai-rag-1',
        text: 'RAG的工作流程是什么？适用于什么场景？',
        keyPoints: ['文档加载', 'Embedding', '向量检索', 'Prompt增强'],
        referenceAnswer: '流程：文档加载→分割→Embedding→存入向量库→查询时检索相关文档→构建Prompt→生成回答。适合需要领域知识、实时数据或减少幻觉的场景。'
      },
      {
        id: 'ai-rag-2',
        text: '常用的向量数据库有哪些？如何选择？',
        keyPoints: ['Chroma', 'Qdrant', 'Pinecone', 'Milvus'],
        referenceAnswer: 'Chroma适合开发和小型项目；Qdrant性能强支持分布式；Pinecone托管服务易扩展；Milvus适合大规模部署。根据规模和运维能力选择。'
      },
      {
        id: 'ai-rag-3',
        text: '长文档如何切块？有什么策略？',
        keyPoints: ['固定长度', '语义分割', '段落边界', '重叠窗口'],
        referenceAnswer: '固定长度切块(512-1024Token)配合重叠(10-20%)保留上下文。语义分割基于句子/段落边界。重要文档可更细粒度。'
      },
      {
        id: 'ai-rag-4',
        text: '余弦相似度和欧氏距离在向量检索中有什么区别？',
        keyPoints: ['相似度计算', '归一化影响', '距离含义', '适用场景'],
        referenceAnswer: '余弦相似度衡量方向相似性，不受向量长度影响。欧氏距离衡量绝对距离，受长度影响。文本匹配常用余弦相似度。'
      },
      // 5. Agent与Function Calling
      {
        id: 'ai-agent-1',
        text: 'Function Calling的工作原理是什么？如何实现？',
        keyPoints: ['工具定义', '参数提取', '调用执行', '结果注入'],
        referenceAnswer: '定义工具描述(JSON Schema)→模型决定调用→提取参数→执行工具→将结果注入上下文→生成最终回答。需要在Prompt中描述可用工具。'
      },
      {
        id: 'ai-agent-2',
        text: 'Agent的"感知-规划-行动"循环是什么？',
        keyPoints: ['感知', '思考', '规划', '执行', '反思'],
        referenceAnswer: '感知：获取环境信息；规划：决定下一步行动；行动：执行工具调用；反思：评估结果调整策略。循环直到完成任务。'
      },
      {
        id: 'ai-agent-3',
        text: '如何实现多工具调用与结果聚合？',
        keyPoints: ['工具选择', '并行调用', '结果合并', '冲突处理'],
        referenceAnswer: 'Agent分析任务决定调用多个工具，可并行执行，将结果按逻辑合并，处理结果冲突时优先选择可靠数据源。'
      },
      {
        id: 'ai-agent-4',
        text: 'Agent的记忆机制有哪些类型？如何实现？',
        keyPoints: ['短期记忆', '长期记忆', '工作记忆'],
        referenceAnswer: '短期记忆存储对话历史；长期记忆用向量数据库存储关键信息；工作记忆存储当前任务状态。检索相关记忆注入上下文。'
      },
      // 6. 评估、幻觉与迭代优化
      {
        id: 'ai-eval-1',
        text: '如何评估AI输出质量？有哪些方法？',
        keyPoints: ['人工评估', 'LLM-as-a-Judge', '客观指标', '一致性检验'],
        referenceAnswer: '人工评估最准确但成本高；LLM作为裁判自动评分；BLEU/Rouge等指标衡量文本相似度；一致性检验检查输出与事实是否矛盾。'
      },
      {
        id: 'ai-eval-2',
        text: '什么是AI幻觉？如何发现和缓解？',
        keyPoints: ['虚假信息', '事实核查', 'RAG约束', '温度调整'],
        referenceAnswer: '幻觉是AI生成无根据的虚假信息。发现：事实核查、引用验证。缓解：使用RAG提供事实依据、降低temperature、要求引用来源。'
      },
      {
        id: 'ai-eval-3',
        text: '如何收集用户反馈并形成数据闭环？',
        keyPoints: ['点赞点踩', '修正输入', '数据存储', '模型微调'],
        referenceAnswer: '提供点赞/点踩按钮，收集用户修正的正确答案，存储到数据库，定期用于Prompt优化或微调模型。'
      },
      {
        id: 'ai-eval-4',
        text: '如何进行Prompt的A/B测试和版本管理？',
        keyPoints: ['版本控制', '分流测试', '效果对比', '迭代优化'],
        referenceAnswer: '对Prompt进行版本标记，使用A/B测试对比不同版本效果，记录关键指标，选择最优版本并持续迭代。'
      }
    ]
  }
];