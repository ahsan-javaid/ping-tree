var URL = require('url')
var http = require('http')
var cuid = require('cuid')
var Corsify = require('corsify')
var sendJson = require('send-data/json')
var ReqLogger = require('req-logger')
var healthPoint = require('healthpoint')
var HttpHashRouter = require('http-hash-router')

var redis = require('./redis')
var version = require('../package.json').version

var router = HttpHashRouter()
var logger = ReqLogger({ version: version })
var health = healthPoint({ version: version }, redis.healthCheck)
var cors = Corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, accept, content-type'
})

router.set('/favicon.ico', empty)

module.exports = function createServer () {
  return http.createServer(cors(handler))
}
router.set('/api/targets', {
  POST: function handler (req, res) {
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      const payload = JSON.parse(body)
      const today = new Date()
      today.setHours(today.getHours() + 24)
      payload.timestamp = today.toISOString()
      payload.processedRequests = 0
      redis.get('targets', function (err, reply) {
        if (err) {
          res.end(err)
        } else {
          const targets = reply ? JSON.parse(reply) : []
          payload.id = targets.length + 1
          targets.push(payload)
          redis.set('targets', JSON.stringify(targets), function (err, reply) {
            if (err) {
              res.end(err)
            } else {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }
          })
        }
      })
    })
  },
  GET: function handler (req, res) {
    redis.get('targets', function (err, reply) {
      if (err) {
        res.end(err)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(reply || '[]')
      }
    })
  }
})

router.set('/api/targets/:id', {
  POST: function handler (req, res, opts) {
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      var payload = JSON.parse(body)
      redis.get('targets', function (err, reply) {
        if (err) {
          res.end(err)
        } else {
          res.setHeader('Content-Type', 'application/json')
          let targets = null
          try {
            targets = JSON.parse(reply)
          } catch (error) {
            targets = []
          }
          const index = targets.findIndex((ele) => (ele.id === parseInt(opts.params.id)))
          if (index !== -1) {
            targets[index] = { ...targets[index], ...payload }
            redis.set('targets', JSON.stringify(targets), function (err, reply) {
              if (err) {
                res.end(err)
              } else {
                res.end(JSON.stringify(targets[index]))
              }
            })
          } else {
            res.statusCode = 404
            const resp = { msg: 'Target not found for this id' }
            res.end(JSON.stringify(resp))
          }
        }
      })
    })
  },
  GET: function handler (req, res, opts) {
    redis.get('targets', function (err, reply) {
      if (err) {
        res.end(err)
      } else {
        const targets = JSON.parse(reply || null)
        const target = targets ? targets.find((ele) => (ele.id === parseInt(opts.params.id))) : null
        res.setHeader('Content-Type', 'application/json')
        if (target) {
          res.end(JSON.stringify(target))
        } else {
          res.statusCode = 404
          const resp = { msg: 'Target not found for this id' }
          res.end(JSON.stringify(resp))
        }
      }
    })
  }
})

router.set('route', {
  POST: function handler (req, res, opts) {
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      var payload = JSON.parse(body)
      redis.get('targets', function (err, reply) {
        if (err) {
          res.end(err)
        } else {
          const targets = reply ? JSON.parse(reply) : []
          const filteredTargets = targets.filter((target, index) => {
            const today = new Date()
            if (new Date(target.timestamp) < today) {
              // Reset maxAcceptsPerDay limit after 24 hours
              // Per day limit handling based on timestamp set to next 24 hours while creating target in post api
              const today = new Date()
              today.setHours(today.getHours() + 24)
              target.timestamp = today.toISOString()
              target.processedRequests = 0
              redis.set('targets', JSON.stringify(targets))
            }
            const visitorHour = new Date(payload.timestamp).getUTCHours()
            if (!!~target.accept.geoState.$in.indexOf(payload.geoState) &&
                target.accept.hour.$in.find((hour) => (parseInt(hour) === visitorHour || (parseInt(hour) + 1) === visitorHour)) &&
                parseInt(target.maxAcceptsPerDay) > target.processedRequests) {
              targets[index].processedRequests = target.processedRequests + 1
              redis.set('targets', JSON.stringify(targets))
              return true
            } else return false
          })
          res.setHeader('Content-Type', 'application/json')
          if (filteredTargets.length) {
            const sortedTargets = filteredTargets.sort((left, right) => (parseFloat(left.value) - parseFloat(right.value)))
            const highest = sortedTargets[sortedTargets.length - 1]
            res.end(JSON.stringify(highest))
          } else {
            res.statusCode = 404
            const resp = { decision: 'reject' }
            res.end(JSON.stringify(resp))
          }
        }
      })
    })
  }
})

function handler (req, res) {
  if (req.url === '/health') return health(req, res)
  req.id = cuid()
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email
    console.log(info)
  })
  router(req, res, { query: getQuery(req.url) }, onError.bind(null, req, res))
}

function onError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  var logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function empty (req, res) {
  res.writeHead(204)
  res.end()
}

function getQuery (url) {
  return URL.parse(url, true).query // eslint-disable-line
}
