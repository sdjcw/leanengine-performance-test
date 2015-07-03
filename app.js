var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cloud = require('./cloud');
var AV = require('leanengine');

var app = express();

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 加载云代码方法
app.use(cloud);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/', function(req, res) {
  res.render('index');
})

// 测试存储性能
// url 示例: /p1?c=2&r=1000
// c 是并发数，r 是总请求数量
// 因为测试可能耗时很长，所以 http 请求直接响应 ok，测试结果到后台查看日志。
var PerformanceTest = AV.Object.extend('PerformanceTest');
app.get('/p1', function(req, res) {
  var concurrent = req.query.c || 1;
  var requestCount = req.query.r || 100;

  res.send('ok'); // 因为测试时间可能很长，所以直接返回，测试异步执行，测试结果从后台日志查看
  console.log('PerformanceTest: concurrent =', concurrent, 'requestCount =', requestCount);
  
  var count = 0;
  var start = new Date();
  
  var preRecordTime = start;
  var preRecordCount = count;
  
  var finished = false; 
 
  var save = function() {
      if (count++ >= requestCount) {
          if (!finished) {
            var qps = 1000 / ((new Date() - start) / count)
            console.log('finished. qps:', qps)
            finished = true;
          }
          return;
      }
      if (count % (requestCount / 10) == 0) {
        var now = new Date();
        console.log('count:', count, 'qps:', 1000 / ((now - preRecordTime) / (count - preRecordCount)));
        preRecordTime = now;
        preRecordCount = count;
      }
      new PerformanceTest().save({foo: 'bar'}, {
          success: function() {
              save();
          },
          error: function(obj, err) {
              console.error('count:', count, 'err:', err)
          }
      })
  };
  for (var i = 0; i < concurrent; i++) {
    save();
  }
})

// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
