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
  },
  {
    name: '系统设计',
    questions: [
      {
        id: 'sd-1',
        text: '如何设计一个短链接系统（如 TinyURL）？',
        keyPoints: ['短码生成算法（哈希+Base62 / 自增ID+62进制）', '分布式唯一性（雪花算法/Redis自增）', '存储方案（MySQL分库分表 + Redis缓存）', '布隆过滤器防缓存穿透', '自定义短码冲突处理', '风控安全（黑名单/有效期）'],
        referenceAnswer: '核心：长URL通过哈希（MD5/SHA256取前7位+Base62）或自增ID转62进制生成短码。分布式场景用雪花算法保证唯一性。存储层MySQL分库分表+Redis缓存热点短链，布隆过滤器防止恶意查询。高可用通过主从复制+多机房部署。安全方面需黑名单机制、短链有效期、恶意链接检测。'
      },
      {
        id: 'sd-2',
        text: '设计一个微博/Twitter Feed流系统',
        keyPoints: ['推模式(Push)：写时扩散到粉丝收件箱', '拉模式(Pull)：读时聚合关注列表', '混合模式：普通用户Push + 大V用户Pull', '明星写扩散问题（5000万粉丝=5000万次写入）', 'Redis List存储Timeline', '分片策略(user_id mod 1024)'],
        referenceAnswer: '推模式写时扩散到所有粉丝收件箱，读取极快但明星用户会造成写扩散。拉模式读时实时聚合，写简单但读取延迟极高。生产环境用混合模式：普通用户推、大V用户拉。存储用Redis List维护Timeline，按user_id分片。降级策略：热点事件时切换为纯拉模式。'
      },
      {
        id: 'sd-3',
        text: '如何设计一个限流器（Rate Limiter）？',
        keyPoints: ['令牌桶(Token Bucket)：允许突发流量', '漏桶(Leaky Bucket)：平滑流量', '滑动窗口(Sliding Window)：精确计数', '分布式限流用Redis原子计数', '限流粒度：接口级/用户级/IP级'],
        referenceAnswer: '令牌桶以固定速率生成令牌，请求消耗令牌，允许一定突发。漏桶固定速率处理，平滑流量。滑动窗口记录精确时间窗口内的请求数。分布式场景用Redis INCR+EXPIRE实现原子计数。粒度分三层：全局QPS、用户级（如1000/min）、IP级。需配合熔断降级防止误伤。'
      },
      {
        id: 'sd-4',
        text: '设计一个分布式唯一ID生成器',
        keyPoints: ['雪花算法(Snowflake)：时间戳+机器ID+序列号', '号段模式(Leaf-Segment)：批量分配', 'Redis自增：简单但有单点风险', 'UUID：无序导致B+树插入性能差', '时钟回拨问题处理'],
        referenceAnswer: '雪花算法64位：41位毫秒时间戳+10位机器ID+12位序列号，每秒可生成409.6万ID。Leaf-Segment模式每次从DB获取一个号段用完再取，减少DB压力。时钟回拨处理：等待时钟追上/用扩展位/抛异常拒绝服务。UUID简单但无序会导致B+树频繁页分裂。'
      },
      {
        id: 'sd-5',
        text: '如何设计一个聊天系统（如微信/WhatsApp）？',
        keyPoints: ['一对一消息 vs 群聊消息路由', '消息可靠性：至少一次/精确一次语义', 'WebSocket长连接 + 心跳保活', '离线消息队列 + 时序消息存储', '已读/未读状态管理', '端到端加密(E2EE)'],
        referenceAnswer: '接入层用WebSocket长连接，通过网关服务路由消息到接收方。在线直接推送，离线存入消息队列待用户上线拉取。群聊消息写扩散到所有群成员收件箱。消息ID用雪花算法保证全局有序。已读未读通过每个会话的last_read_seq实现。端到端加密在客户端生成密钥，服务端不持有明文。'
      },
      {
        id: 'sd-6',
        text: '如何设计一个分布式缓存系统？',
        keyPoints: ['一致性哈希解决节点扩缩容', '缓存淘汰策略：LRU/LFU/TTL', '缓存穿透：布隆过滤器/空值缓存', '缓存击穿：互斥锁/永不过期+异步更新', '缓存雪崩：随机过期时间/多级缓存'],
        referenceAnswer: '一致性哈希将节点映射到环上，增减节点时仅影响相邻节点数据迁移。淘汰策略：LRU最近最少用、LFU访问频率最低、TTL定时过期。穿透防护：布隆过滤器过滤不存在key、缓存空值。击穿防护：热点key用互斥锁保证仅一个线程回源、或逻辑过期+异步刷新。雪崩防护：过期时间加随机值、多级缓存(本地+远程)。'
      },
      {
        id: 'sd-7',
        text: '什么是CAP定理？在分布式系统中如何取舍？',
        keyPoints: ['C(Consistency)一致性', 'A(Availability)可用性', 'P(Partition Tolerance)分区容错', 'P必须满足——网络分区不可避免', 'CP系统 vs AP系统', '最终一致性（BASE理论）'],
        referenceAnswer: 'CAP定理：分布式系统最多同时满足一致性、可用性、分区容错中的两个。P是必须的（网络分区不可控），实际在CP和AP间选择。CP（如ZooKeeper、etcd）：发生分区时优先一致性，牺牲可用性。AP（如Cassandra、Eureka）：优先可用性，采用最终一致性。BASE理论是对CAP中AP的补充：基本可用+柔性状态+最终一致。'
      },
      {
        id: 'sd-8',
        text: '如何设计一个分布式消息队列？',
        keyPoints: ['生产者→Broker→消费者模型', '消息持久化：顺序写磁盘(CommitLog)', '消息可靠性：ACK机制 + 重试 + 死信队列', '消费者组与分区再均衡(Rebalance)', '顺序消息 vs 并发消息', '延迟消息/事务消息'],
        referenceAnswer: 'Broker接收消息后顺序写入CommitLog（类似Kafka），消费者拉取消息处理并返回ACK。可靠性：至少一次（重试+幂等）、精确一次（事务消息）。分区机制：同一key的消息路由到同一分区保证局部有序。消费者组内再均衡：消费者增减时重新分配分区。延迟消息用时间轮调度，事务消息用二阶段提交。'
      },
      {
        id: 'sd-9',
        text: '设计一个秒杀系统需要关注哪些点？',
        keyPoints: ['前端：静态化+CDN+按钮防重复', '网关层：限流(令牌桶)+验证码', '服务层：Redis预减库存+消息队列异步下单', '数据库层：乐观锁/行锁防超卖', '降级预案：流量峰值熔断/排队'],
        referenceAnswer: '全链路优化：前端页面静态化+CDN分发，按钮点击后置灰防重复。网关层令牌桶限流+验证码拦截机器人。核心逻辑：Redis预减库存（lua脚本原子操作），抢到资格则发送消息队列异步创建订单。数据库乐观锁(version字段)或 `UPDATE ... WHERE stock > 0` 防超卖。降级：流量过大时返回排队页面。'
      },
      {
        id: 'sd-10',
        text: '解释一致性哈希的原理和应用',
        keyPoints: ['哈希环：0~2^32-1', '虚拟节点解决数据倾斜', '节点增减时仅影响相邻节点', '应用：分布式缓存/负载均衡', '对比：普通取模哈希节点变化时全部重映射'],
        referenceAnswer: '一致性哈希将节点和key映射到0~2^32-1的哈希环上，key分配到顺时针第一个节点。节点增减时仅影响相邻节点，数据迁移量小。虚拟节点：每个物理节点映射多个虚拟节点到环上，解决数据倾斜。应用：Redis Cluster、Dubbo负载均衡、CDN节点调度。普通取模哈希（key%N）在N变化时全部key需要重新映射。'
      },
      {
        id: 'sd-11',
        text: '什么是负载均衡？常见算法有哪些？',
        keyPoints: ['四层(L4) vs 七层(L7)负载均衡', '轮询/加权轮询', '最少连接/加权最少连接', '一致性哈希(会话保持)', '健康检查机制', 'Nginx/HAProxy/LVS对比'],
        referenceAnswer: 'L4基于IP+端口转发（LVS、F5），性能高但不感知HTTP内容。L7基于HTTP头/URL路由（Nginx、HAProxy），灵活但性能略低。算法：轮询适合均匀分配；加权轮询为高性能机器分配更多流量；最少连接分配给连接数最少的后端；一致性哈希实现会话保持。健康检查：TCP连接探测/HTTP状态码探测。'
      },
      {
        id: 'sd-12',
        text: '如何设计一个实时排行榜系统？',
        keyPoints: ['有序集合(Redis ZSet)实现实时排行', '分段排行榜：小时/日/周/总榜', '定时任务聚合+缓存', '海量用户场景：分片+近似排行', 'Top-K查询优化'],
        referenceAnswer: 'Redis ZSet的score存储积分，zrevrange获取Top-K，zscore查用户排名。分段设计：小时榜实时更新、日榜定时归并、周榜/总榜异步聚合。海量用户用分片ZSet（按用户ID哈希），查询时合并各分片Top-K再排序。近似方案：用分桶统计，牺牲少量精度换性能。'
      },
      {
        id: 'sd-13',
        text: '什么是幂等性？如何保证接口幂等？',
        keyPoints: ['幂等：多次执行结果与一次执行相同', '唯一ID(业务单号)去重', '数据库唯一索引约束', '状态机+乐观锁', 'Token机制（先获取Token再消费）'],
        referenceAnswer: '幂等性保证同一操作执行多次的结果与执行一次相同。实现方式：① 客户端生成唯一业务ID，服务端Redis/DB记录已处理的ID；② 数据库唯一索引，重复插入失败；③ 状态机：已处理的订单不再重复处理；④ Token机制：先申请Token，请求携带Token，处理完删除Token。'
      },
      {
        id: 'sd-14',
        text: '什么是服务降级和服务熔断？有什么区别？',
        keyPoints: ['熔断(Circuit Breaker)：防止故障扩散', '降级(Degradation)：关闭非核心功能保核心', '熔断三态：关闭→打开→半开', '降级策略：返回兜底数据/默认值/静态页面', 'Sentinel/Hystrix实现'],
        referenceAnswer: '熔断：当服务调用失败率达到阈值（如50%），熔断器打开直接返回fallback，防止级联故障。经过冷却时间后半开状态尝试少量请求，成功则关闭。降级：系统压力大时关闭非核心功能（如推荐、排行榜），保证核心链路（下单、支付）。熔断是被动防护，降级是主动取舍。常用Sentinel、Hystrix实现。'
      },
      {
        id: 'sd-15',
        text: '如何估算一个系统的QPS和存储容量？（系统设计面试第一步）',
        keyPoints: ['DAU → 日均请求量 → 平均QPS → 峰值QPS(×3-5)', '存储：单条数据大小 × 日增量 × 保留天数', '带宽：峰值QPS × 平均响应体大小', '缓存：热点数据量 × 副本数', '数字敏感度：1亿用户/1KB数据 → 100GB'],
        referenceAnswer: '推算链：假设DAU 1000万，人均请求50次/天 → 日均5亿请求 → 平均QPS≈5800 → 峰值QPS=平均×3≈1.75万。存储：单条1KB × 日均500万条 × 保留90天 = 450GB。带宽：峰值QPS 1.75万 × 平均响应10KB = 175MB/s。缓存：20%热点数据 × 总数据量 × 3副本。关键数字：1亿×1KB≈100GB，1Gbps≈125MB/s。'
      }
    ]
  },
  {
    name: '数据库',
    questions: [
      {
        id: 'db-1',
        text: 'MySQL为什么使用B+树作为索引结构？',
        keyPoints: ['B+树非叶子节点仅存键+指针，扇出高、树高矮（3-4层）', '叶子节点有序链表连接，支持高效范围查询', '对比B树：B树节点存数据导致扇出低', '对比Hash：Hash不支持范围查询和排序', '磁盘I/O友好：一次I/O加载一个节点'],
        referenceAnswer: 'B+树非叶子节点不存数据只存索引键，扇出度极高，树的高度通常3-4层，每次查询只需3-4次磁盘I/O。叶子节点形成有序双向链表，范围查询只需找到起始位置再顺序遍历。B树节点存数据导致扇出低、树更高。Hash索引虽然等值查询O(1)，但不支持范围查询和ORDER BY排序。'
      },
      {
        id: 'db-2',
        text: '什么是聚簇索引和非聚簇索引？InnoDB的主键索引是怎样的？',
        keyPoints: ['聚簇索引：数据与索引存于同一B+树，叶子节点存完整行', '非聚簇索引（二级索引）：叶子节点存主键值', '回表：二级索引→主键→聚簇索引查完整数据', 'InnoDB必须有聚簇索引（显式PK或隐式ROW_ID）', 'MyISAM全是非聚簇索引'],
        referenceAnswer: 'InnoDB中聚簇索引的B+树叶子节点直接存储完整行数据，表本身就是按主键组织的。非聚簇索引（二级索引）叶子节点存储的是主键值。当二级索引无法覆盖查询列时，需要先查二级索引获得主键，再回聚簇索引查完整行——这叫"回表"。覆盖索引可避免回表：查询的列全部包含在二级索引中。'
      },
      {
        id: 'db-3',
        text: '什么是最左前缀匹配原则？联合索引(a,b,c)哪些查询能用到索引？',
        keyPoints: ['最左前缀：从联合索引最左列开始顺序匹配', '(a,b,c)支持：a / ab / abc 条件', '不支持：跳过a → bc无法用索引', '范围查询(between/>/</like)会使后续列索引失效', '等值查询可以任意顺序（优化器自动调整）'],
        referenceAnswer: '联合索引(a,b,c)按a→b→c顺序建立B+树。能用索引的查询：WHERE a=1、WHERE a=1 AND b=2、WHERE a=1 AND b=2 AND c=3。不能用的：WHERE b=2（跳过a）、WHERE a=1 AND c=3（跳过b）。WHERE a=1 AND b>2 AND c=3中c无法使用索引因为b用了范围查询。注意：WHERE a=1 AND c=3 AND b=2中优化器会把条件调整为a,b,c顺序。'
      },
      {
        id: 'db-4',
        text: 'MySQL的事务隔离级别有哪些？各自解决什么问题？',
        keyPoints: ['READ UNCOMMITTED：脏读', 'READ COMMITTED：解决脏读，存在不可重复读', 'REPEATABLE READ(默认)：解决不可重复读，MVCC+间隙锁解决幻读', 'SERIALIZABLE：解决幻读，串行执行', '脏读/不可重复读/幻读的定义和区别'],
        referenceAnswer: '四种隔离级别：① RU未提交读——可能读到其他事务未提交的修改（脏读）；② RC已提交读——只能读到已提交的数据，但同一事务内两次SELECT结果可能不同（不可重复读）；③ RR可重复读（InnoDB默认）——同一事务内多次SELECT结果一致，MVCC解决不可重复读，间隙锁解决幻读；④ 串行化——事务串行执行，完全隔离，性能最低。'
      },
      {
        id: 'db-5',
        text: '什么是MVCC（多版本并发控制）？Read View的可见性判断规则？',
        keyPoints: ['MVCC通过Undo Log维护数据多版本', '隐藏字段：DB_TRX_ID(事务ID)、DB_ROLL_PTR(回滚指针)', 'Read View：记录当前活跃事务的快照', '可见性规则：trx_id < min_trx_id 可见', 'RC每次SELECT创建新Read View，RR事务内复用'],
        referenceAnswer: 'MVCC为每行数据维护多个版本（通过Undo Log）。每行有隐藏字段：DB_TRX_ID记录最后修改的事务ID，DB_ROLL_PTR指向Undo Log中的旧版本。Read View包含当前活跃事务列表，可见性规则：① 如果trx_id < min_trx_id，已提交→可见；② trx_id > max_trx_id，未开始→不可见；③ 如果在m_ids中→不可见（除非是当前事务自己）。RC每次SELECT创建新Read View（能读到最新提交），RR首次SELECT创建Read View后复用（保证可重复读）。'
      },
      {
        id: 'db-6',
        text: '如何用EXPLAIN分析SQL执行计划？关键字段有哪些？',
        keyPoints: ['type：访问类型（ALL<index<range<ref<eq_ref<const）', 'key：实际使用的索引（NULL=全表扫描）', 'rows：预估扫描行数', 'Extra：Using index=覆盖索引 / Using filesort=文件排序 / Using temporary=临时表', '至少达到range级别，避免ALL'],
        referenceAnswer: 'EXPLAIN关键字段：① type访问类型——从差到好ALL全表扫描→index全索引扫描→range索引范围→ref非唯一索引→eq_ref唯一索引→const主键/唯一常量；② key使用的索引名，NULL说明没用索引；③ rows预估扫描行数，越小越好；④ Extra额外信息——Using index=覆盖索引不走回表、Using filesort=额外排序需优化、Using temporary=用了临时表要避免。优化目标type至少range，Extra避免filesort和temporary。'
      },
      {
        id: 'db-7',
        text: 'SQL慢查询如何定位和优化？完整排查流程是什么？',
        keyPoints: ['开启slow_query_log + long_query_time=1s', 'mysqldumpslow / pt-query-digest分析慢日志', 'EXPLAIN查看执行计划', '优化手段：加索引/覆盖索引/改写SQL/分库分表', '效果验证：执行时间对比、慢SQL数量下降≥80%'],
        referenceAnswer: '流程：① 开启慢查询日志（long_query_time=1s）；② 用mysqldumpslow或pt-query-digest分析TOP慢SQL；③ EXPLAIN分析执行计划识别全表扫描/索引失效；④ 优化：缺失索引补索引、SELECT *改为只查必要列、大表LIMIT深分页改为WHERE id>N方式、JOIN确保关联字段有索引；⑤ 验证执行时间并持续监控慢SQL数量。'
      },
      {
        id: 'db-8',
        text: '什么是索引下推（Index Condition Pushdown）？',
        keyPoints: ['MySQL 5.6+特性', '将WHERE过滤条件下推到存储引擎层', '减少回表次数', '适用：联合索引中部分条件无法使用但可过滤', 'EXPLAIN的Extra显示Using index condition'],
        referenceAnswer: '索引下推是MySQL 5.6+的优化：将WHERE中存储引擎可以判断的过滤条件下推到引擎层执行，在索引遍历时直接过滤，减少回表次数。例如联合索引(name, age)，查询WHERE name LIKE "张%" AND age=20，传统方式先根据name找到所有行回表再过滤age；ICP下推后在索引层就过滤age=20，只对匹配的行回表。EXPLAIN Extra字段显示"Using index condition"。'
      },
      {
        id: 'db-9',
        text: 'MySQL的行锁、表锁、间隙锁分别是什么？什么情况下使用？',
        keyPoints: ['行锁(Record Lock)：锁住索引记录', '间隙锁(Gap Lock)：锁住索引记录间的间隙', '临键锁(Next-Key Lock)：行锁+间隙锁=左开右闭区间', '表锁：LOCK TABLES / MDL锁', 'RR隔离级别下默认使用Next-Key Lock防止幻读'],
        referenceAnswer: '行锁锁住索引记录，通过 `SELECT ... FOR UPDATE` 加锁。间隙锁锁住索引记录间的间隙，防止其他事务在此间隙插入新记录（防止幻读）。临键锁=行锁+间隙锁，锁住一个左开右闭区间。RR隔离级别下InnoDB默认使用临键锁防止幻读。注意：行锁是加在索引上的，如果WHERE条件不走索引会升级为表锁！表锁用LOCK TABLES显式加锁，MDL锁是元数据锁。'
      },
      {
        id: 'db-10',
        text: '什么是分库分表？水平和垂直拆分的区别？',
        keyPoints: ['触发条件：单表>1000万行或单库容量瓶颈', '垂直拆分：按业务/字段拆分（如user_base和user_extend）', '水平拆分：按主键哈希/时间等拆分多表', '跨分片JOIN/事务问题', 'ShardingSphere-JDBC / MyCat中间件', '全局唯一ID（雪花算法）'],
        referenceAnswer: '分库分表是数据库水平扩展的手段。垂直拆分：按业务模块拆不同库（订单库、用户库）或将大字段拆分（user_base + user_extend），减少单行I/O。水平拆分：按分片键（如user_id%16或时间范围）将同一张表拆分到多个库/表。核心挑战：① 跨分片JOIN需应用层聚合；② 分布式事务用柔性事务(Seata)；③ 全局唯一ID用雪花算法；④ 分片键选择决定查询是否走单分片。常用ShardingSphere-JDBC。'
      },
      {
        id: 'db-11',
        text: 'MySQL主从复制原理是什么？有哪些复制模式？',
        keyPoints: ['主库写Binlog → 从库IO线程拉取 → 写入Relay Log → SQL线程回放', '异步复制：主库不等待从库确认', '半同步复制：至少一个从库确认', '并行复制：多线程回放提高效率', '主从延迟原因与监控'],
        referenceAnswer: '复制流程：主库事务提交时写入Binary Log → 从库IO线程拉取Binlog写入Relay Log → 从库SQL线程读取Relay Log回放执行。异步复制：主库提交后不等待从库，性能高但可能丢数据。半同步复制：主库等待至少一个从库接收到Binlog才返回，保证数据不丢。并行复制（MySQL 5.7+）：按库/组提交并行回放，减少主从延迟。延迟监控：`SHOW SLAVE STATUS` 查看 Seconds_Behind_Master。'
      },
      {
        id: 'db-12',
        text: '什么是Redis缓存穿透、缓存击穿、缓存雪崩？如何解决？',
        keyPoints: ['穿透：查不存在的key → 布隆过滤器+空值缓存', '击穿：热点key过期 → 互斥锁+逻辑过期', '雪崩：大量key同时过期 → 随机过期时间+多级缓存', '三者本质区别：查询对象/并发程度/影响范围'],
        referenceAnswer: '穿透：大量查询不存在的数据，请求穿过缓存打到DB。解决：布隆过滤器过滤不存在的key，或缓存空值（短TTL）。击穿：热点key过期瞬间，大量并发请求直接打DB。解决：互斥锁保证只有一个线程回源更新缓存；或逻辑过期+后台异步刷新。雪崩：大量key在同一时刻过期或Redis宕机。解决：过期时间加随机值（±30%）、多级缓存（本地Caffeine+远程Redis）、限流降级。'
      },
      {
        id: 'db-13',
        text: '数据库连接池的工作原理？常用参数如何设置？',
        keyPoints: ['连接池维护一组预创建的长连接', '核心参数：最大连接数/最小空闲/超时时间', '连接数公式：((核心数*2)+有效磁盘数)', 'HikariCP为什么快：字节码级优化', '连接泄漏检测与处理'],
        referenceAnswer: '连接池预先创建一组数据库连接，请求时借用、用完归还，避免频繁创建/销毁TCP连接的开销。核心参数：maximumPoolSize = Tn * (Cm - 1) + 1（Tn=最大线程数，Cm=单个连接最大并发数）；connectionTimeout=30s；idleTimeout=10min；maxLifetime=30min。HikariCP通过字节码级优化、无锁设计、精简代码实现极致性能。连接泄漏检测：leakDetectionThreshold配置，超时未归还打印警告。'
      },
      {
        id: 'db-14',
        text: '什么是数据库的死锁？如何排查和避免？',
        keyPoints: ['死锁：两个事务互相等待对方持有的锁', 'InnoDB自动检测死锁并回滚代价小的事务', '排查：SHOW ENGINE INNODB STATUS查看LATEST DETECTED DEADLOCK', '避免：固定加锁顺序/缩短事务/使用合适隔离级别', 'SELECT ... FOR UPDATE的影响'],
        referenceAnswer: '死锁发生条件：互斥、持有等待、不可剥夺、循环等待。InnoDB有死锁检测机制，检测到死锁时自动回滚undo量小的事务。排查：`SHOW ENGINE INNODB STATUS` 查看死锁日志，分析事务1持有哪些锁等待哪些、事务2持有哪些锁等待哪些。避免策略：① 所有事务以相同顺序访问资源（如先锁账户A再锁账户B）；② 缩短事务时间；③ 尽量用RC而非RR减少间隙锁；④ 批量操作分批提交。'
      },
      {
        id: 'db-15',
        text: 'InnoDB的Redo Log和Undo Log分别是什么？WAL机制？',
        keyPoints: ['Redo Log(重做日志)：物理日志，保证持久性', 'Undo Log(回滚日志)：逻辑日志，保证原子性+MVCC', 'WAL(Write-Ahead Logging)：先写日志再写磁盘', 'Redo Log两阶段：Prepare→Binlog→Commit', '崩溃恢复：利用Redo Log+Binlog重做/回滚'],
        referenceAnswer: 'Redo Log是物理日志，记录"对哪个数据页做了什么修改"，用于崩溃恢复保证持久性。采用循环写（固定两个文件ib_logfile0/1）。Undo Log是逻辑日志，记录修改前数据状态，用于事务回滚（原子性）和MVCC（多版本）。WAL机制：修改先写Redo Log（顺序写，快），后台再刷脏页到磁盘（随机写，慢）。二阶段提交：Prepare(写Redo)→写Binlog→Commit(Redo标记完成)，保证Redo和Binlog一致。'
      }
    ]
  },
  {
    name: '操作系统',
    questions: [
      {
        id: 'os-1',
        text: '进程和线程的区别是什么？',
        keyPoints: ['进程是资源分配的最小单位，线程是CPU调度的最小单位', '进程拥有独立地址空间，线程共享进程地址空间', '进程切换开销大（页表切换/TLB刷新），线程切换仅切换栈和寄存器', '进程间通信需IPC（管道/共享内存/消息队列），线程直接共享内存', '一个进程崩溃不影响其他进程，一个线程崩溃可能导致整个进程退出'],
        referenceAnswer: '核心区别：进程是操作系统资源分配的基本单位，拥有独立的虚拟地址空间、文件描述符表；线程是CPU调度的基本单位，共享所属进程的地址空间和文件等资源。进程切换需要切换页表、刷新TLB，开销大；线程切换只需切换栈指针和寄存器，开销小。进程间通信需要OS提供的IPC机制；线程间直接通过共享变量通信，但需要同步机制（互斥锁/信号量）防止竞态条件。'
      },
      {
        id: 'os-2',
        text: '什么是虚拟内存？为什么需要虚拟内存？',
        keyPoints: ['虚拟内存：程序看到的连续、私有地址空间由MMU+页表映射到物理内存', '进程隔离：不同进程相同虚拟地址映射到不同物理页', '提高内存利用率：按需调页(Demand Paging)', '突破物理内存限制：页面可换出到磁盘', '安全保护：通过页表权限位控制读/写/执行'],
        referenceAnswer: '虚拟内存是OS提供的内存抽象——每个进程看到的是连续、私有的虚拟地址空间，实际上由MMU通过多级页表将虚拟地址转换为物理地址。作用：① 进程隔离——进程A的0x1000和进程B的0x1000映射到不同物理页，互不干扰；② 按需调页——只加载实际访问的页到内存；③ 页面置换——不常用页换出到磁盘swap，突破物理内存限制；④ 权限保护——页表项设置rwx权限位。'
      },
      {
        id: 'os-3',
        text: 'select、poll、epoll的区别是什么？epoll为什么高效？',
        keyPoints: ['select：fd_set位图，默认最大1024，每次O(n)扫描全部fd', 'poll：pollfd数组，无fd上限，但仍是O(n)扫描', 'epoll：红黑树管理fd+就绪链表，只遍历就绪fd，O(1)获取', 'epoll通过回调+mmap减少内核到用户空间拷贝', 'LT(水平触发) vs ET(边缘触发)'],
        referenceAnswer: 'select用fd_set位图，最大1024，每次调用需传入全部fd，内核O(n)线性扫描。poll用pollfd数组无上限，但仍需传入全部fd线性扫描。epoll用epoll_ctl添加fd到红黑树(O(log n))，事件触发时通过回调将就绪fd放入就绪链表，epoll_wait直接取链表(O(1))，只拷贝就绪fd到用户态。另外epoll通过mmap共享内存减少拷贝。LT模式：有数据就通知直到读完；ET模式：状态变化时只通知一次，必须非阻塞一次性读完。'
      },
      {
        id: 'os-4',
        text: '什么是零拷贝（Zero Copy）？sendfile为什么比read+write快？',
        keyPoints: ['传统read+write：4次拷贝(2 DMA+2 CPU)+4次上下文切换', 'mmap+write：3次拷贝+4次上下文切换', 'sendfile(SG-DMA)：2次DMA拷贝+0次CPU拷贝+2次上下文切换', 'Kafka/Netty/Nginx都使用零拷贝', '零拷贝不是零拷贝，是指无CPU参与的拷贝'],
        referenceAnswer: '传统文件传输：read()磁盘→内核缓冲区(DMA)→用户缓冲区(CPU)→write()内核Socket缓冲区(CPU)→网卡(DMA)，共4次拷贝+4次上下文切换。sendfile零拷贝：磁盘→内核缓冲区(DMA)→内核Socket缓冲区→网卡(DMA)。使用SG-DMA时仅2次DMA拷贝+2次上下文切换，完全没有CPU参与的数据拷贝。Kafka用sendfile将日志文件直接传输到Socket；Nginx用sendfile传输静态文件。"零拷贝"指零CPU拷贝，DMA拷贝仍然存在。'
      },
      {
        id: 'os-5',
        text: '进程间通信（IPC）有哪些方式？各自适用场景？',
        keyPoints: ['管道(匿名/命名)：字节流，父子进程或任意进程', '消息队列：有边界消息，异步解耦', '共享内存：最快，需配合同步机制', '信号量：计数器，进程间互斥同步', 'Socket：跨主机通信', '信号：异步事件通知，信息量有限'],
        referenceAnswer: '① 匿名管道(pipe)：内核缓冲区字节流，仅父子/兄弟进程间使用，半双工。② 命名管道(FIFO)：有文件系统路径名，任意进程可通信。③ 消息队列：内核维护的消息链表，保留消息边界，异步解耦。④ 共享内存：多进程映射同一物理内存区域，速度最快（无内核介入），需配合信号量/互斥锁同步。⑤ 信号量：计数器控制同时访问资源的进程数。⑥ Socket：支持跨主机通信，如Redis客户端-服务端。⑦ 信号：SIGKILL/SIGTERM等异步通知。'
      },
      {
        id: 'os-6',
        text: '什么是死锁？四个必要条件？如何预防和避免？',
        keyPoints: ['死锁：多个进程互相等待对方持有的资源', '必要条件：互斥/持有等待/不可剥夺/循环等待', '预防：破坏任一条件（如一次性申请所有资源）', '避免：银行家算法(安全序列判断)', '检测+恢复：定期检测死锁→回滚/剥夺资源'],
        referenceAnswer: '四个必要条件必须同时满足：① 互斥——资源不可共享；② 持有等待——持有资源的同时等待其他资源；③ 不可剥夺——已分配资源不能被强制收回；④ 循环等待——存在进程资源等待环。预防：破坏任一条件——如一次性申请所有资源（破坏持有等待）、资源排序（破坏循环等待）。避免：银行家算法判断是否存在安全序列。实际系统多采用鸵鸟策略(忽略)+超时重试，因为死锁概率低但预防开销大。'
      },
      {
        id: 'os-7',
        text: '什么是上下文切换？哪些情况会触发？如何减少开销？',
        keyPoints: ['上下文切换：CPU从执行一个进程/线程切换到另一个', '触发场景：时间片用完/等待I/O/抢占/系统调用', '开销：保存恢复寄存器/PC/栈指针/页表切换', '线程切换比进程切换快（共享地址空间）', '减少手段：协程/CPU亲和性/减少锁竞争'],
        referenceAnswer: '上下文切换是CPU从一个进程/线程切换到另一个的过程，需要保存当前任务的状态（寄存器、PC、栈指针）并恢复下一个任务的状态。触发：① 时间片到期；② I/O等待主动让出CPU；③ 高优先级进程抢占；④ 系统调用。进程切换额外开销：切换页表基址寄存器、TLB全刷新。减少方法：① 协程在用户态切换（无内核态开销）；② CPU亲和性绑定；③ 减少不必要的锁竞争；④ 异步非阻塞I/O减少线程等待。'
      },
      {
        id: 'os-8',
        text: '什么是页面置换算法？LRU如何实现？',
        keyPoints: ['OPT(最佳)：淘汰未来最久不用的页——理论最优不可实现', 'FIFO：淘汰最早进入的页——简单但有Belady异常', 'LRU(最近最久未用)：淘汰最久未访问的页——常用', 'Clock(时钟)：环形链表+访问位——LRU低开销近似', 'LRU实现：双向链表+HashMap(O(1))'],
        referenceAnswer: '当物理内存满时，需要选择淘汰一个页腾出空间。OPT选择未来最久不用的页淘汰，是最优但不现实。FIFO淘汰最早进入的页，简单但存在Belady异常（分配更多物理页反而缺页更多）。LRU淘汰最近最久未访问的页，效果好但精确实现开销大。LRU实现：双向链表+HashMap，访问时移到链表头，淘汰链表尾，O(1)操作。Clock算法是LRU的近似：环形链表遍历，访问位=1则清0继续，=0则淘汰，实际系统常用。'
      },
      {
        id: 'os-9',
        text: '用户态和内核态的区别？系统调用的过程？',
        keyPoints: ['用户态：受限指令集，不能直接访问硬件/特权资源', '内核态：完全权限，可执行特权指令', '系统调用：用户程序请求内核服务的接口', '切换过程：int 0x80/syscall → 查中断向量表 → 内核处理 → 返回用户态', '开销：模式切换+参数拷贝+TLB刷新'],
        referenceAnswer: '用户态CPU运行在Ring 3，只能访问受限的指令和内存，无法直接操作硬件、修改页表。内核态Ring 0有完全权限。用户程序通过系统调用（open/read/write/fork等）请求内核服务。流程：① 应用程序调用C库函数→② 将系统调用号存入eax寄存器→③ 触发软中断(int 0x80)或syscall指令→④ CPU切换到内核态→⑤ 内核根据系统调用号查表执行对应函数→⑥ 结果返回用户态。开销比普通函数调用大得多（上下文切换+TLB刷新）。'
      },
      {
        id: 'os-10',
        text: '什么是内存碎片？内部碎片和外部碎片的区别？',
        keyPoints: ['内部碎片：分配给进程的内存中未被使用的部分', '外部碎片：空闲内存块之间无法利用的小间隙', '分页产生内部碎片（最后一页通常未用完）', '分段产生外部碎片（段大小不一）', '解决方案：紧缩(Compaction)、分页、Slab分配器'],
        referenceAnswer: '内部碎片：已分配给进程的内存块中未使用的部分。如分页系统中进程需要3.5KB却分配了4KB(一整页)，多出的0.5KB即为内部碎片。外部碎片：空闲内存总量足够但分散成小块无法分配给需要的进程。如分段系统中频繁分配释放不同大小的段造成。现代OS用分页（固定大小）消除外部碎片，用Slab分配器减少内核内部碎片。用户态内存分配器(jemalloc/tcmalloc)通过大小类管理减少碎片。'
      },
      {
        id: 'os-11',
        text: '多线程编程中的锁有哪些类型？各自适用场景？',
        keyPoints: ['互斥锁(Mutex)：独占访问，最简单常用', '读写锁(RWLock)：读共享写独占，适合读多写少', '自旋锁(SpinLock)：忙等待不切换上下文，适合极短临界区', '条件变量(CondVar)：等待/通知模式', '信号量(Semaphore)：控制并发访问数', '无锁编程(CAS)：原子操作避免锁开销'],
        referenceAnswer: '互斥锁：任一时刻只有一个线程持有，适合大多数场景。读写锁：允许多个读者并发，写者独占，适合读多写少（如缓存更新）。自旋锁：忙等待循环检查锁状态，不释放CPU，适合临界区极短（几微秒）的场景，避免上下文切换开销。条件变量：配合Mutex实现等待/通知——生产者-消费者模型、等待特定条件满足。信号量：控制同时访问某资源的最大线程数（如连接池）。CAS(Compare-And-Swap)：原子操作实现无锁数据结构，避免锁竞争开销。'
      },
      {
        id: 'os-12',
        text: 'Linux的进程调度算法CFS（完全公平调度）的原理？',
        keyPoints: ['CFS目标：分配公平的CPU时间给所有进程', 'vruntime(虚拟运行时间)：实际运行时间 × (1024/权重)', '红黑树按vruntime排序，最小vruntime的进程优先', 'nice值影响权重(nice 0→权重1024, nice -20→权重88761)', '时间片动态计算：基于cfs_period和进程数'],
        referenceAnswer: 'CFS不分配固定的时间片，而是追踪每个进程的vruntime（虚拟运行时间）。vruntime = 实际运行时间 × (1024 / 进程权重)，权重按nice值计算。红黑树按vruntime排序，CFS始终选择vruntime最小的进程运行（即获得CPU时间最少的进程），保证长期来看所有进程获得公平的CPU份额。nice值越低（优先级越高）权重越大，vruntime增长越慢，获得更多CPU。新进程以当前最小vruntime加入，防止饥饿。'
      },
      {
        id: 'os-13',
        text: '什么是TLB（快表）？TLB miss会怎样？',
        keyPoints: ['TLB：CPU内部缓存虚拟→物理地址映射的硬件', '命中：1个时钟周期完成地址转换', 'Miss：需查多级页表(走内存)，开销大', '上下文切换需刷新TLB或打ASID标签', '大页(Huge Pages)减少TLB Miss'],
        referenceAnswer: 'TLB是CPU内部的高速缓存，存储最近使用的页表项（虚拟地址→物理地址映射）。TLB命中：1个CPU周期内完成地址转换。TLB Miss：需要逐级遍历多级页表（访问内存），通常4次内存访问（4级页表），开销巨大。上下文切换时TLB需要刷新（因新进程地址空间不同），可通过ASID(地址空间标识符)避免全刷新。大页（2MB/1GB）可以大幅减少TLB条目数，降低Miss率——大量数据访问场景（Redis、DB）常用。'
      },
      {
        id: 'os-14',
        text: '什么是I/O多路复用？Reactor和Proactor模式的区别？',
        keyPoints: ['I/O多路复用：单线程监听多个fd，就绪时通知处理', 'Reactor：同步非阻塞I/O，应用主动读写（select/epoll）', 'Proactor：异步I/O，内核完成读写后回调通知', 'Reactor代表：Netty、Nginx、Redis', 'Proactor代表：IOCP(Windows)、io_uring(Linux)'],
        referenceAnswer: 'I/O多路复用让单线程同时监听多个文件描述符，避免一个线程阻塞在一个连接上。Reactor模式（同步非阻塞）：主线程注册事件，事件就绪时通知应用自己去读写数据。实现：单Reactor单线程(Redis)、主从Reactor多线程(Netty/Nginx)。Proactor模式（异步I/O）：发起异步读写操作后立即返回，内核完成数据拷贝后回调通知应用处理。IOCP(Windows)是Proactor实现，io_uring(Linux 5.1+)提供类似能力。Reactor应用更广，Proactor理论上更高效但编程模型复杂。'
      },
      {
        id: 'os-15',
        text: '什么是内存映射文件（mmap）？适用场景？',
        keyPoints: ['mmap将文件映射到进程虚拟地址空间', '访问映射区域时触发缺页中断加载文件页', '修改后通过msync刷回磁盘', '对比read/write：减少一次用户缓冲区拷贝', '适用：大文件随机访问、进程间共享内存、零拷贝'],
        referenceAnswer: 'mmap将文件在虚拟地址空间建立映射，之后访问这段内存就像访问普通内存一样。首次访问触发缺页中断→内核从磁盘加载对应页到Page Cache→建立映射。修改通过msync或munmap刷回磁盘。相比read/write的优势：减少内核到用户空间的一次拷贝（数据在Page Cache中，进程直接访问）。适用场景：大文件随机读写（数据库）、进程间共享内存、零拷贝文件传输（mmap+write比read+write少一次拷贝）。注意：小文件用read/write更好（mmap有缺页开销）。'
      }
    ]
  },
  {
    name: 'AI基础',
    questions: [
      {
        id: 'ai-1',
        text: '详细解释Transformer的自注意力机制工作原理',
        keyPoints: ['Q(Query)/K(Key)/V(Value)三个矩阵从输入线性变换得到', 'Attention(Q,K,V) = softmax(Q·K^T / √dk) · V', '除以√dk防止内积过大导致softmax梯度消失', '多头注意力：多组QKV并行捕获不同子空间特征', '自注意力可以并行计算，打破RNN的序列依赖'],
        referenceAnswer: '自注意力机制让序列中每个位置都与所有其他位置直接交互。计算流程：① 输入X分别与Wq、Wk、Wv矩阵相乘得到Q、K、V；② 注意力分数 = softmax(QK^T / √dk)，得到每个位置对其他位置的关注权重；③ 加权求和 = 注意力权重 × V。除以√dk缩放防止点积值过大使softmax趋近one-hot导致梯度消失。多头注意力用多组QKV并行捕获不同表示子空间。相比RNN，自注意力可以在O(1)路径长度内捕获任意距离的依赖。'
      },
      {
        id: 'ai-2',
        text: '什么是位置编码？为什么Transformer需要它？',
        keyPoints: ['Transformer自注意力是置换不变的——丢失位置信息', '正弦/余弦位置编码：PE(pos,2i)=sin(pos/10000^(2i/d))', '可学习位置编码：随机初始化+训练优化', 'RoPE(旋转位置编码)：通过旋转矩阵编码相对位置', 'ALiBi：直接加线性偏置到注意力分数'],
        referenceAnswer: 'Transformer的自注意力对输入没有先后顺序感知（输入打乱顺序输出也相应打乱），因此必须注入位置信息。正余弦编码：使用sin/cos函数生成固定编码，不同维度不同频率，可外推到训练时未见过的长度。RoPE旋转位置编码：将Q、K向量按位置旋转，使内积仅依赖相对位置差，是目前LLaMA/Qwen等主流模型的首选。ALiBi不在输入加编码而是在注意力分数加线性偏置，外推能力强。'
      },
      {
        id: 'ai-3',
        text: 'MHA、MQA、GQA的区别是什么？各自的应用场景？',
        keyPoints: ['MHA(多头注意力)：每个头独立的K/V，推理时KV Cache大', 'MQA(多查询注意力)：所有头共享一组K/V，省显存但可能损失精度', 'GQA(分组查询注意力)：折中方案，同组内共享K/V', 'KV Cache显存 = batch × seq_len × num_heads × head_dim × 2', 'LLaMA2/3用GQA，DeepSeek用MLA(更低秩压缩)'],
        referenceAnswer: '核心区别在推理时的KV Cache大小。MHA每个注意力头都有独立的K和V矩阵，KV Cache = seq_len × num_heads × head_dim × 2个元素，大模型推理显存瓶颈所在。MQA所有头共享一组K/V，KV Cache降为原来的1/num_heads，但表达能力可能降低。GQA折中：将num_heads个头分成num_groups组，同组内共享K/V，如LLaMA2-70B用8组。DeepSeek-V2提出MLA将KV压缩到极低维度latent space，进一步优化。'
      },
      {
        id: 'ai-4',
        text: '什么是LoRA（Low-Rank Adaptation）？为什么能大幅减少微调参数？',
        keyPoints: ['冻结预训练权重W，训练低秩分解矩阵A和B', '前向：h = W·x + B·A·x（B和A是低秩矩阵）', '秩r通常取8~64，远小于原始维度', '仅训练A和B，参数量减少99%+', "推理时W' = W + B·A可合并为单一矩阵，无额外推理开销"],
        referenceAnswer: `LoRA基于假设：模型适配新任务时权重的更新矩阵ΔW是低秩的。它将ΔW分解为两个小矩阵B×A的乘积（秩r远小于原始维度）。训练时冻结预训练权重W，只更新A和B，前向传播为 h = Wx + BAx。例如原始矩阵4096×4096(≈16.8M参数)，LoRA r=16时A(16×4096)+B(4096×16)≈131K参数，减少99%+。推理时可将BA合并到W中（W'=W+BA），无额外推理开销。QLoRA在LoRA基础上引入4bit量化进一步降低显存。`
      },
      {
        id: 'ai-5',
        text: 'RAG（检索增强生成）的工作流程是什么？解决什么问题？',
        keyPoints: ['解决LLM的幻觉和知识截止问题', '流程：文档加载→文本分割→Embedding→向量存储→检索→增强生成', '检索阶段：用户Query→Embedding→向量相似度搜索→返回Top-K文档片段', '生成阶段：检索结果+原始Query→构建Prompt→LLM生成答案', '关键优化：切块策略/重排序/混合检索/查询改写'],
        referenceAnswer: 'RAG在LLM生成答案前先检索外部知识库中的相关文档作为上下文，解决LLM的两个核心问题：① 幻觉（生成虚假信息）——用真实文档约束；② 知识截止——检索最新信息。流程：离线阶段→文档加载、语义分割、Embedding向量化、存入向量数据库。在线阶段→用户Query向量化、在向量库中相似度搜索Top-K文档片段、将检索结果拼接进Prompt、LLM基于检索内容生成答案。优化方向：混合检索(向量+关键词)、重排序(Reranker)、查询改写(HyDE)、多跳检索。'
      },
      {
        id: 'ai-6',
        text: 'RLHF（基于人类反馈的强化学习）的核心流程是什么？',
        keyPoints: ['三阶段：SFT(监督微调)→RM(奖励模型训练)→PPO(强化学习优化)', 'SFT：用高质量人工标注数据微调基座模型', 'RM：收集人类偏好数据(成对比较)，训练奖励模型打分', 'PPO：用RM作为奖励信号优化策略模型', 'PPO中KL惩罚防止模型偏离SFT太远', 'DPO(直接偏好优化)可跳过显式RM训练'],
        referenceAnswer: 'RLHF三阶段：① SFT——收集高质量指令-回复对，微调基座模型使其会遵循指令格式；② RM训练——对同一个Prompt生成多个回复，人工标注偏好排序（A>B>C），用Bradley-Terry模型训练奖励模型学习人类偏好；③ PPO——用RM作为奖励函数，PPO算法优化策略模型（SFT模型），加入KL散度惩罚防止策略偏离原始SFT太远导致生成质量下降。DPO是RLHF的简化：直接在偏好数据上用分类损失优化策略模型，省去显式训练RM的步骤。'
      },
      {
        id: 'ai-7',
        text: '什么是AI幻觉（Hallucination）？如何缓解？',
        keyPoints: ['幻觉：LLM生成看似合理但与事实不符的内容', '原因：训练数据噪声/过度泛化/解码策略/缺乏事实约束', '缓解：RAG(检索真实文档约束生成)', '降低Temperature减少随机性', 'Prompt中要求引用来源/输出不确定时明确标注', '后处理：事实核查+过滤'],
        referenceAnswer: 'AI幻觉指模型生成内容看似通顺合理，但包含与事实不符的信息。根因：① 训练数据本身的错误和偏见；② 模型本质是概率性下一个token预测而非事实推理；③ 高温解码增加随机性。缓解策略：① RAG用检索到的真实文档约束生成内容；② 降低temperature(0.1-0.3)减少随机性；③ Prompt工程——要求模型在不确定时说"我不确定"并引用来源；④ 后处理事实核查——用另一个模型/NLI验证关键事实；⑤ 微调时加入事实一致性奖励信号。但无法完全消除幻觉。'
      },
      {
        id: 'ai-8',
        text: 'Decoder-Only（GPT）、Encoder-Only（BERT）、Encoder-Decoder（T5）架构的区别？',
        keyPoints: ['Encoder-Only：双向注意力，适合理解任务（分类/NER）', 'Decoder-Only：自回归单向注意力，适合生成任务', 'Encoder-Decoder：编码器理解输入+解码器生成输出，适合翻译/摘要', 'GPT系列(Decoder-Only)占据主流：Scaling Law+上下文学习能力', 'Attention Mask差异：因果掩码(Decoder)vs 全连接(Encoder)'],
        referenceAnswer: 'Encoder-Only(BERT)：双向自注意力，每个位置能看到所有其他位置，擅长理解任务（文本分类、命名实体识别），不能生成。Decoder-Only(GPT)：因果自注意力（掩码未来位置），自回归逐个生成token，擅长生成任务，GPT系列通过Scaling发现涌现能力。Encoder-Decoder(T5/BART)：编码器双向理解输入→解码器自回归生成，天然适合序列转换（翻译、摘要），但架构更复杂。当前Decoder-Only主导大模型，因为其结构简单、Scaling效果好、上下文学习能力强。'
      },
      {
        id: 'ai-9',
        text: '什么是Tokenization？BPE和WordPiece的区别？',
        keyPoints: ['Tokenization：将文本分割成模型可处理的最小单元', 'BPE(Byte-Pair Encoding)：统计频率最高字符对→迭代合并', 'WordPiece：类似BPE但用概率而非频率选择合并', 'BPE从底向上构建词表(合并最频繁对)', 'WordPiece用语言模型似然增益决定合并'],
        referenceAnswer: 'Tokenization将原始文本转换为模型能处理的token ID序列。BPE：从基础字符开始，统计语料中所有相邻符号对的频率，合并最高频对并加入词表，迭代直到达到目标词表大小。GPT系列使用BPE。WordPiece：类似BPE，但合并标准是最大化语言模型似然增益，而非简单频率统计，BERT使用WordPiece。子词切分的好处：平衡词级和字符级——常用词作为整体token，罕见词分解为子词，完全未见的词可分解为已知字符。'
      },
      {
        id: 'ai-10',
        text: '什么是MoE（混合专家模型）？如何实现条件计算？',
        keyPoints: ['MoE将FFN层替换为多个"专家"+一个门控路由器', '每个token仅激活Top-K(通常K=2)个专家', '门控网络输出专家选择概率+负载均衡损失', '总参数量大但推理计算量小(稀疏激活)', '挑战：负载不均/通信开销/训练不稳定', '代表：Mixtral 8x7B、DeepSeek-V3'],
        referenceAnswer: 'MoE将Transformer的FFN层替换为N个并行的"专家"（小FFN），门控网络（Router）为每个token选择最相关的Top-K个专家（通常K=2）。模型总参数量=N×单专家参数，但每个token仅激活K个专家，因此计算量接近K个专家的FLOPs而非全部。需加负载均衡损失防止所有token都路由到少数专家。Mixtral 8x7B有8个专家每次激活2个，总参数量47B但推理计算量≈13B稠密模型。DeepSeek-V3的MoE扩展到256个专家每次激活8个+Tops-K路由+辅助损失。'
      },
      {
        id: 'ai-11',
        text: '大模型训练中的并行策略有哪些？数据并行/张量并行/流水线并行的区别？',
        keyPoints: ['数据并行(DP)：每GPU持完整模型副本，数据分片，梯度AllReduce同步', '张量并行(TP)：单层内矩阵运算切分到多GPU', '流水线并行(PP)：模型按层切分，Micro-Batch流水线执行', '3D并行=DP+TP+PP组合', 'ZeRO：优化器状态/梯度/参数分片（数据并行的内存优化版）'],
        referenceAnswer: '数据并行：每个GPU持有完整模型副本，输入batch分片，各自前向反向，梯度通过AllReduce同步后统一更新。简单但每GPU需存完整模型+优化器状态。张量并行：将单层的大矩阵乘法沿行/列切分到多GPU并行计算，通信在每层前后，适合单机多卡。流水线并行：模型按层切分给不同GPU，数据以Micro-Batch流水线流动减少GPU空闲。3D并行组合使用DP+TP+PP。ZeRO(DeepSpeed)：分3阶段——ZeRO-1分片优化器状态、ZeRO-2增加梯度分片、ZeRO-3再增加参数分片，本质是数据并行的显存优化版。'
      },
      {
        id: 'ai-12',
        text: '什么是FP16/BF16混合精度训练？为什么需要Loss Scaling？',
        keyPoints: ['混合精度：前向/反向用FP16加速，权重更新用FP32保证精度', 'FP16范围6×10^-8 ~ 65504，梯度下溢风险', 'BF16范围与FP32相同(指数位相同)，不需Loss Scaling', 'Loss Scaling：loss乘大系数→梯度放大→恢复防止FP16下溢', 'FP16训练提速约2-3倍，显存减半'],
        referenceAnswer: '混合精度训练：前向传播和反向传播使用FP16（速度快、显存省），主权重和优化器状态保持FP32（保证精度）。问题：FP16表示范围有限(6e-8~65504)，小梯度可能下溢为0。Loss Scaling：将loss乘以一个大系数(如2^16)放大梯度使其落入FP16范围，反向后再除以系数恢复。BF16(brain floating point)与FP32指数位相同，动态范围一致，不需要Loss Scaling，但尾数位少可能损失精度。现代GPU(A100/H100)硬件支持BF16和TF32。'
      },
      {
        id: 'ai-13',
        text: 'Function Calling的工作原理是什么？Agent如何实现工具调用？',
        keyPoints: ['定义工具JSON Schema描述函数名/参数/描述', '将工具定义注入System Prompt或API tools参数', '模型决定是否调用及调用哪个工具→输出函数名+参数JSON', '应用解析→执行函数→结果注入上下文→模型生成最终回复', 'Agent循环：感知→规划→行动→反思'],
        referenceAnswer: 'Function Calling让LLM能通过调用外部工具扩展能力。流程：① 定义工具描述（函数名、参数Schema、功能描述）；② 用户Query+工具定义→模型判断是否需要调用工具；③ 需要时模型输出函数名和参数JSON（而非普通文本）；④ 应用程序执行函数并将结果作为新的上下文消息返回模型；⑤ 模型基于工具返回结果生成最终回答。Agent在此基础上加上记忆和规划能力：感知环境→制定计划→选择工具执行→观察结果→反思调整→重复直到完成目标。'
      },
      {
        id: 'ai-14',
        text: '什么是Prompt Engineering？有哪些核心技巧？',
        keyPoints: ['System Prompt：角色定义+行为约束+输出格式', 'Few-shot：3-5个示例显著提升特定任务效果', 'Chain-of-Thought(CoT)：引导模型逐步推理', '结构化输出：指定JSON格式+Schema约束+标签包裹', '角色扮演+思维链+分步指令+格式约束'],
        referenceAnswer: 'Prompt Engineering是通过设计输入文本引导LLM行为的技术。核心技巧：① 角色设定——System Prompt中定义专家角色和行为约束；② Few-shot示例——提供3-5个高质量示例示范期望格式和风格；③ Chain-of-Thought——在Prompt中加入"让我们一步步思考"引导模型分解推理过程；④ 结构化输出——明确JSON Schema、用标签包裹输出部分、设置low temperature；⑤ 分步指令——将复杂任务拆解为清晰步骤编号。进阶：Self-Consistency(多次采样投票)、Tree-of-Thought(树状探索推理路径)。'
      },
      {
        id: 'ai-15',
        text: '如何评估大模型的性能？常用Benchmark有哪些？',
        keyPoints: ['MMLU：多学科知识(57个学科选择题)，衡量知识广度', 'HumanEval：代码生成(164道Python题)，衡量编程能力', 'C-Eval：中文综合能力评估', 'MT-Bench：多轮对话能力，用LLM-as-Judge评分', '长文本：Needle-in-a-Haystack（大海捞针）', '评估维度：知识/推理/代码/对话/安全/对齐'],
        referenceAnswer: '评估维度覆盖知识、推理、代码、对话、安全等。常用Benchmark：① MMLU——57个学科的选择题测试，衡量模型百科知识全面性；② HumanEval/MBPP——代码生成正确率（pass@k）；③ C-Eval/CMMLU——中文综合能力；④ MT-Bench/AlpacaEval——用GPT-4作为裁判对比模型回答质量；⑤ Needle-in-Haystack——在长文本中检索特定信息，测试长上下文能力；⑥ GSM8K/MATH——数学推理。评估方法：零样本/少样本评测、人工评估、LLM-as-Judge。'
      }
    ]
  },
  {
    name: '产品设计',
    questions: [
      {
        id: 'pd-1',
        text: '如何从0到1设计一款产品？完整流程是什么？',
        keyPoints: ['用户调研：定性（访谈）→ 定量（问卷）验证假设', '需求分析：用户故事地图 + 优先级排序(RICE/MoSCoW)', '竞品分析：差异化定位', 'MVP定义：核心价值的最小可行产品', '上线后数据驱动迭代：AARRR模型'],
        referenceAnswer: '流程：① 发现阶段——用户访谈挖掘痛点，定量验证需求规模；② 定义阶段——用用户故事地图梳理核心流程，竞品分析找差异化空间；③ 设计阶段——低保真原型快速验证，高保真详细设计；④ MVP阶段——确定最小可行功能集，砍掉nice-to-have；⑤ 开发阶段——与研发协作迭代交付；⑥ 上线后——通过数据验证假设（AARRR模型），持续迭代优化。核心原则：小步快跑、数据驱动、用户反馈闭环。'
      },
      {
        id: 'pd-2',
        text: '什么是AARRR模型？每个阶段的核心指标是什么？',
        keyPoints: ['Acquisition(获客)：CAC、渠道转化率', 'Activation(激活)：新用户首日关键行为完成率', 'Retention(留存)：次日/7日/30日留存率', 'Revenue(变现)：ARPU、LTV、付费转化率', 'Referral(传播)：K因子(病毒系数)、NPS'],
        referenceAnswer: 'AARRR是用户增长漏斗模型。① 获客：用户从哪里来？关注渠道获客成本(CAC)和安装注册转化率。② 激活：用户首次体验到核心价值，关注关键行为完成率（如注册后完成第一笔交易）。③ 留存：用户是否会回来，次日/7日/30日留存率——30日留存是PMF核心指标。④ 变现：如何赚钱，ARPU、LTV、付费率。⑤ 传播：用户是否推荐，K因子=邀请数×转化率，>1意味病毒增长。'
      },
      {
        id: 'pd-3',
        text: '如何做需求优先级排序？RICE模型和Kano模型的区别？',
        keyPoints: ['RICE：Reach(覆盖人数)×Impact(影响程度)×Confidence(信心)/Effort(工作量)', 'MoSCoW：Must/Should/Could/Won\'t have', 'Kano模型：基本型/期望型/兴奋型/无差异型/反向型需求', 'RICE适合量化排序，Kano适合识别需求类型', '优先级=用户价值×战略契合度÷开发成本'],
        referenceAnswer: 'RICE模型：Reach(影响多少用户)×Impact(对用户的改变程度1-3)×Confidence(有多大把握%)÷Effort(人月)。总分越高优先级越高，适合数据驱动的排序。Kano模型：将需求分为五类——基本需求(不满足用户愤怒)、期望需求(越满足越满意)、兴奋需求(超出预期)、无差异需求(做不做无关)、反向需求(做了反而不好)。RICE适合日常迭代排期，Kano适合产品战略层面的需求分类和差异化设计。'
      },
      {
        id: 'pd-4',
        text: '如何撰写一份合格的PRD（产品需求文档）？',
        keyPoints: ['产品概述：背景/目标/范围', '用户画像与场景', '功能需求：用例/交互流程/边界条件', '非功能需求：性能/安全/兼容性', '数据指标：衡量成功的KPI', '不需要的内容：技术实现方案（由研发团队负责）'],
        referenceAnswer: 'PRD结构：① 文档信息（版本/日期/负责人）；② 产品背景——为什么要做、解决什么问题；③ 用户画像——谁会使用、典型使用场景；④ 功能详述——交互流程+页面原型+边界条件+异常处理；⑤ 数据埋点需求——需要监控哪些指标验证效果；⑥ 非功能需求——性能(响应时间<200ms)、安全性、兼容性；⑦ 上线计划——灰度策略、AB测试方案。原则：描述"要什么"而非"怎么实现"，技术方案由研发决定。'
      },
      {
        id: 'pd-5',
        text: 'A/B测试如何设计和实施？有哪些注意事项？',
        keyPoints: ['明确假设：如果做了X变化，Y指标会提升Z%', '单变量测试——每次只改一个因素', '样本量计算——根据预期效应大小和显著性水平', '随机分流+AA验证（确保分流均匀）', '统计显著性(p<0.05)+实际显著性(效应量)', 'AI产品的AB测试特殊性：输出随机性需更大样本'],
        referenceAnswer: '标准流程：① 形成假设——"把注册按钮改成橙色，转化率提升5%"；② 确定主指标（注册转化率）和护栏指标（次日留存不下降）；③ 计算所需样本量（根据MDE最小可检测效应、显著性水平α=0.05、统计功效1-β=0.8）；④ 用户随机分流，先跑AA测试验证分流均匀；⑤ 运行足够天数（至少覆盖一个完整周周期）；⑥ 分析结果——关注统计显著性(p值)+实际显著性(效应量大小)。AI产品的AB测试特殊挑战：模型输出随机性、长期效应、指标选择复杂性。'
      },
      {
        id: 'pd-6',
        text: '如何进行用户调研？定性和定量方法的区别和搭配？',
        keyPoints: ['定性：用户访谈(发现why)、可用性测试(发现问题)', '定量：问卷(验证规模)、数据分析(发现what)', '定性先于定量：访谈发现假设→问卷验证规模', '用户画像(Persona)：综合定性和定量数据构建', '常见错误：仅依赖问卷而忽略行为数据'],
        referenceAnswer: '定性方法（访谈、可用性测试）回答"为什么"——发现用户痛点、行为背后的动机。定量方法（问卷、数据分析、A/B测试）回答"是什么"和"有多少"——验证需求规模、衡量效果。推荐顺序：先用定性方法探索问题形成假设（访5-8个用户能发现80%+的可用性问题），再用定量方法验证假设的普遍性。用户画像是两种方法的结合：定性构建故事，定量验证代表性。误区：过度依赖问卷（用户说和做不一致），须结合行为数据交叉验证。'
      },
      {
        id: 'pd-7',
        text: 'AI产品经理和传统产品经理有什么区别？需要哪些额外能力？',
        keyPoints: ['技术理解：大模型原理/Token/Embedding/Prompt工程', '不确定性管理：模型输出非确定性，容错设计', '数据驱动更强：数据获取/清洗/标注闭环', '评估体系不同：传统指标(CTR/留存)+AI特有指标(幻觉率/有用性)', '伦理与合规：内容安全/偏见/隐私', '更强的跨职能协作：与AI研究员和工程团队'],
        referenceAnswer: '核心差异：① 技术素养——理解Transformer、Token、Embedding、RAG等基础概念，能与算法工程师有效沟通；② 不确定性管理——LLM输出非确定性，产品设计需要容错和降级策略；③ 数据闭环——模型效果依赖高质量数据，需设计数据采集→标注→评估→反馈的飞轮；④ 评估体系——除传统产品指标外，还需评估生成质量（BLEU/人工评分）、幻觉率、有用性等AI特有指标；⑤ 伦理合规——内容安全审核、偏见检测、隐私保护等新增维度。'
      },
      {
        id: 'pd-8',
        text: '如何判断一个产品是否达到了PMF（产品市场契合）？',
        keyPoints: ['PMF：产品满足真实市场需求的状态', '核心指标：自然增长+高留存+用户主动推荐', 'Sean Ellis测试：如果产品消失用户会多失望？>40%非常失望=PMF', '留存是硬指标——30日留存≥同品类Top 25%', '定性验证：用户"会疼"（解决真实痛点）+自发传播'],
        referenceAnswer: '判断PMF的量化指标：① 自然增长率——有机流量占比持续提升（不依赖投放）；② 留存曲线——周留存/月留存曲线趋于平缓（用户真正离不开）；③ 推荐指标——NPS>40或高比例的WOM(口碑)获客。定性判断：Sean Ellis测试——向活跃用户发问卷"如果产品明天消失你什么感受"，>40%选"非常失望"说明达PMF。另一个信号：用户自发为产品做内容(发帖推荐/主动安利)。PMF不是二元状态，是程度——初期可能是细分人群PMF，逐步扩展到更广人群。'
      },
      {
        id: 'pd-9',
        text: '如何做竞品分析？从哪些维度入手？',
        keyPoints: ['直接竞品(同需求同方案)vs间接竞品(同需求不同方案)', '功能对比表：核心功能/体验/价格/技术', '用户口碑：应用商店评分+社交媒体+用户访谈', '商业模型：收入来源/成本结构/市场份额', 'SWOT分析：优劣势+机会威胁', '分析目标：找差异化机会而非模仿'],
        referenceAnswer: '竞品分析五步法：① 识别竞品——直接竞品（相同解决方案）、间接竞品（解决相同需求不同方式）、潜在竞品；② 功能矩阵对比——核心功能是否覆盖、体验优劣、价格定位；③ 用户视角——爬取App Store/应用市场低分评论找用户真实不满（差异化机会点）；④ 商业分析——收入模型、融资情况、团队规模评估其资源投入能力；⑤ SWOT分析——我方优势切入、竞品弱点攻击。核心原则：竞品分析是为了找到差异化机会，而非照搬功能。抄竞品只会成为更差的竞品。'
      },
      {
        id: 'pd-10',
        text: '什么是用户故事（User Story）？如何写好用户故事？',
        keyPoints: ['标准格式：作为<角色>，我想要<功能>，以便<价值>', 'INVEST原则：Independent/Negotiable/Valuable/Estimable/Small/Testable', '用户故事地图(User Story Mapping)：按用户旅程串联故事', 'Epic→Feature→User Story→Task的层级分解', '验收标准(Acceptance Criteria)：Given/When/Then格式'],
        referenceAnswer: '用户故事是从用户视角描述需求的方式，标准格式："作为一个[角色]，我想要[做什么]，以便[获得什么价值]"。INVEST原则：Independent独立可开发、Negotiable可协商细节、Valuable对用户有价值、Estimable可估算工作量、Small一个Sprint内可完成、Testable可测试验证。用户故事地图将故事按用户旅程时间线排列，上方是按步骤的"用户活动"，下方是对应的具体故事，帮助团队看到全景并规划MVP范围。验收标准用GWT格式：Given前提条件→When用户操作→Then期望结果。'
      },
      {
        id: 'pd-11',
        text: '某电商App月活用户下降20%，作为PM如何分析和解决？',
        keyPoints: ['数据分层：新用户/老用户/回流用户各自变化', '渠道排查：各投放渠道转化率是否变化', '产品诊断：近期上线的功能是否负面影响', '竞品动态：是否有新竞品抢用户', '季节性因素：是否为正常波动', '制定行动计划：针对主要问题制定改进方案'],
        referenceAnswer: '分析框架：① 数据拆解——DAU=新用户+老用户留存+回流用户，分别看哪部分下降（如新用户不变但老用户留存降→产品问题；新用户骤降→渠道问题）；② 同期影响——是否有版本更新/运营活动结束/竞品大促/季节性；③ 用户分层——不同活跃层级（高频/中频/低频）和不同渠道来源的用户表现各异；④ 漏斗分析——哪个环节转化率下降？⑤ 竞品扫描——是否有新的替代品或竞品促销活动；⑥ 用户访谈——抽样回访流失用户了解原因。定位问题后：建立假设→验证→快速修复→数据复盘。'
      },
      {
        id: 'pd-12',
        text: '什么是NPS（净推荐值）？如何计算和使用？',
        keyPoints: ['NPS = 推荐者% - 贬损者%', '核心问题："0-10分你有多大可能推荐给朋友？"', '9-10分=推荐者 / 7-8分=被动者 / 0-6分=贬损者', 'NPS>50优秀，>70世界级', '应用：定期追踪+追问原因+关联行为数据'],
        referenceAnswer: 'NPS通过一个问题衡量用户忠诚度："0-10分，你有多大可能向朋友推荐我们的产品？"。9-10分为推荐者（Promoter）、7-8分为被动者（Passive）、0-6分为贬损者（Detractor）。NPS = 推荐者占比 - 贬损者占比，范围-100到100。>50为优秀，>70为世界级（如Apple）。使用技巧：① 必追问——"给这个分数的原因是什么？"定性反馈比数字更有价值；② 定期追踪趋势；③ 按用户分层分析（付费vs免费、新vs老）；④ 与行为数据关联（高NPS用户留存是否真的更高）；⑤ NPS不能替代留存等硬指标，需综合判断。'
      },
      {
        id: 'pd-13',
        text: '如何设计AI产品的Prompt策略和交互流程？',
        keyPoints: ['System Prompt：定义角色+行为边界+输出格式', '用户输入预处理：意图识别+敏感内容过滤', '多轮对话设计：记忆管理+上下文窗口优化', '容错设计：输出格式校验+重试+降级', '用户反馈闭环：点赞/点踩+修正内容收集'],
        referenceAnswer: 'AI产品Prompt策略分层：① System层——定义AI角色身份、专业领域边界、安全合规约束、输出格式模板；② 上下文层——动态注入用户画像、历史对话摘要、相关文档（RAG结果）；③ 用户输入层——对用户输入做预处理（意图识别、PII过滤），必要时改写为更精确的Prompt。交互流程设计要点：输出格式校验（JSON.parse失败→重试或降级为自由文本）；加载状态设计（流式输出逐字显示减少感知延迟）；错误处理（明确告诉用户AI无法回答什么、提供人工客服入口）；反馈闭环（👍👎按钮+用户修正→收集高质量数据用于持续优化）。'
      },
      {
        id: 'pd-14',
        text: '如何制定产品的北极星指标（North Star Metric）？',
        keyPoints: ['北极星指标：衡量产品长期为用户创造的核心价值', '特征：反映用户价值/可衡量/团队可影响/可预测长期增长', 'Spotify：内容消费时间 / Airbnb：预订夜间数', '与虚荣指标的区别：注册数vs活跃数vs真正创造价值的指标', '拆解为输入指标→各团队对齐'],
        referenceAnswer: '北极星指标是衡量产品为用户创造核心价值的一级指标。好指标的特征：① 反映用户获得的价值（而非仅仅是商业收入）；② 可被团队日常决策影响；③ 可衡量且有明确的提升方向；④ 与长期商业成功正相关。如Spotify是"听歌时长"而非"注册用户数"——后者是虚荣指标。制定方法：识别用户完成什么行为代表真正获得价值→该行为的频次或深度→量化为可追踪的指标。拆解：北极星指标→各团队的输入指标（如"搜索成功率"→"搜索后购买率"→北极星"交易额"）。'
      },
      {
        id: 'pd-15',
        text: '什么是数据驱动的产品决策？如何避免常见的数据陷阱？',
        keyPoints: ['数据驱动≠只看数据——结合定性理解和战略判断', '常见陷阱：幸存者偏差/混淆因果与相关/误导性指标', '指标分层：北极星指标+活跃指标+诊断指标', '实验文化：每个重大决策都尽量有AB测试验证', '警惕：平均数的欺骗性（看分布而非只看均值）'],
        referenceAnswer: '数据驱动决策是用数据验证假设而非替代判断。流程：形成假设→设计实验→收集数据→判断→迭代。常见陷阱：① 幸存者偏差——只看到成功的用户而忽略流失的；② 混淆相关与因果——数据上相关的两个变量不一定有因果关系；③ 虚荣指标——关注"注册数"而非"7日活跃注册数"；④ 平均数陷阱——用户使用时长均值看似正常，但可能少数超重度用户拉高了均值。规避方法：看分位数分布、做AA验证(确认分流的随机性有效性)、量化指标置信区间、数据+定性交叉验证。'
      }
    ]
  }
];