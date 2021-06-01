process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('Post a target', function (t) {
  const url = '/api/targets'
  const body = {
    url: 'http://example1.com',
    value: '2.50',
    maxAcceptsPerDay: '5',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  const req = servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'statusCode')
    t.is(typeof res.body, 'object', 'body is object')
    t.end()
  })
  req.end(JSON.stringify(body))
})

test.serial.cb('Get all targets', function (t) {
  const url = '/api/targets'
  servertest(server(), url, { encoding: 'json', method: 'GET' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'statusCode')
    t.is(res.body.length, 1, 'response has one target')
    t.end()
  })
})

test.serial.cb('Get target by id', function (t) {
  const url = '/api/targets/1'
  servertest(server(), url, { encoding: 'json', method: 'GET' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'statusCode')
    t.is(typeof res.body, 'object', 'body is object')
    t.end()
  })
})

test.serial.cb('Update target by id', function (t) {
  const url = '/api/targets/1'
  const body = {
    url: 'http://updatedUrl.com',
    value: '2.50',
    maxAcceptsPerDay: '5',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  const req = servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'statusCode')
    t.is(typeof res.body, 'object', 'body is object')
    t.is(res.body.url, 'http://updatedUrl.com', 'updated the url')
    t.end()
  })
  req.end(JSON.stringify(body))
})

test.serial.cb('Visitor route', function (t) {
  const url = '/route'
  const body = {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2021-06-02T13:32:51.060Z'
  }
  const req = servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'statusCode')
    t.is(typeof res.body, 'object', 'body is object')
    t.end()
  })
  req.end(JSON.stringify(body))
})
