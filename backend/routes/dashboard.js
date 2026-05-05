const express = require('express');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth());

function ensureRole(roleList) {
  return (req, res, next) => {
    if (roleList.includes(req.user.role)) return next();
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  };
}

function mergeMatch(baseFilter = {}, extraFilter = {}) {
  const keysBase = Object.keys(baseFilter);
  const keysExtra = Object.keys(extraFilter);
  if (!keysBase.length) return extraFilter;
  if (!keysExtra.length) return baseFilter;
  return { $and: [baseFilter, extraFilter] };
}

router.get('/summary', ensureRole(['admin', 'agent']), async (req, res) => {
  try {
    const roleFilter =
      req.user.role === 'agent'
        ? {
            $or: [{ assignedAgent: req.user.id }, { assignedAgent: null }, { watchers: req.user.id }]
          }
        : {};

    const [totalTickets, byStatus, byPriority, users, resolutionByPriority, satisfactionDistribution, satisfactionSummary] = await Promise.all([
      Ticket.countDocuments(roleFilter),
      Ticket.aggregate([
        { $match: roleFilter },
        { $group: { _id: '$status', total: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: roleFilter },
        { $group: { _id: '$priority', total: { $sum: 1 } } }
      ]),
      User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }]),
      Ticket.aggregate([
        { $match: mergeMatch(roleFilter, { resolvedAt: { $ne: null } }) },
        {
          $project: {
            priority: 1,
            resolutionHours: {
              $divide: [
                { $subtract: [{ $ifNull: ['$closedAt', '$resolvedAt'] }, '$createdAt'] },
                1000 * 60 * 60
              ]
            }
          }
        },
        {
          $group: {
            _id: '$priority',
            avgHours: { $avg: '$resolutionHours' },
            resolved: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Ticket.aggregate([
        { $match: mergeMatch(roleFilter, { satisfactionRating: { $gte: 1 } }) },
        {
          $group: {
            _id: { $round: ['$satisfactionRating', 0] },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Ticket.aggregate([
        { $match: mergeMatch(roleFilter, { satisfactionRating: { $gte: 1 } }) },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$satisfactionRating' },
            totalRatings: { $sum: 1 }
          }
        }
      ])
    ]);

    const ticketsLast7Days = await Ticket.aggregate([
      {
        $match: mergeMatch(roleFilter, {
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        })
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalResolvedCount = resolutionByPriority.reduce((acc, item) => acc + (item.resolved || 0), 0);
    const weightedResolution = resolutionByPriority.reduce(
      (acc, item) => acc + ((item.avgHours || 0) * (item.resolved || 0)),
      0
    );

    res.json({
      ok: true,
      summary: {
        totalTickets,
        byStatus,
        byPriority,
        usersByRole: users,
        recentTickets: ticketsLast7Days,
        resolutionByPriority,
        satisfaction: {
          distribution: satisfactionDistribution,
          average: satisfactionSummary[0]?.avgRating || 0,
          totalRatings: satisfactionSummary[0]?.totalRatings || 0
        },
        avgResolutionHours: totalResolvedCount ? weightedResolution / totalResolvedCount : 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'No se pudo calcular el resumen' });
  }
});

router.get('/team-performance', ensureRole(['admin']), async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: 'tickets',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$assignedAgent', '$$userId'] } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                resolved: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0]
                  }
                },
                avgSatisfaction: { $avg: '$satisfactionRating' },
                avgResolutionHours: {
                  $avg: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$resolvedAt', null] },
                          { $ne: ['$createdAt', null] }
                        ]
                      },
                      {
                        $divide: [
                          {
                            $subtract: [
                              { $ifNull: ['$closedAt', '$resolvedAt'] },
                              '$createdAt'
                            ]
                          },
                          3600000
                        ]
                      },
                      null
                    ]
                  }
                }
              }
            }
          ],
          as: 'agentStats'
        }
      },
      {
        $lookup: {
          from: 'tickets',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$assignedProgrammer', '$$userId'] } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                ready: {
                  $sum: {
                    $cond: [{ $eq: ['$programmerReady', true] }, 1, 0]
                  }
                },
                avgReadyHours: {
                  $avg: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$programmerReadyAt', null] },
                          { $ne: ['$createdAt', null] }
                        ]
                      },
                      {
                        $divide: [
                          { $subtract: ['$programmerReadyAt', '$createdAt'] },
                          3600000
                        ]
                      },
                      null
                    ]
                  }
                }
              }
            }
          ],
          as: 'programmerStats'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          agentStats: { $arrayElemAt: ['$agentStats', 0] },
          programmerStats: { $arrayElemAt: ['$programmerStats', 0] }
        }
      },
      {
        $addFields: {
          agentTickets: { $ifNull: ['$agentStats.total', 0] },
          agentResolved: { $ifNull: ['$agentStats.resolved', 0] },
          agentAvgResolutionHours: { $ifNull: ['$agentStats.avgResolutionHours', null] },
          agentAvgSatisfaction: { $ifNull: ['$agentStats.avgSatisfaction', null] },
          programmerTickets: { $ifNull: ['$programmerStats.total', 0] },
          programmerReady: { $ifNull: ['$programmerStats.ready', 0] },
          programmerAvgReadyHours: { $ifNull: ['$programmerStats.avgReadyHours', null] }
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          agentTickets: 1,
          agentResolved: 1,
          agentAvgResolutionHours: 1,
          agentAvgSatisfaction: 1,
          programmerTickets: 1,
          programmerReady: 1,
          programmerAvgReadyHours: 1
        }
      }
    ];
    const users = await User.aggregate(pipeline);
    res.json({ ok: true, performance: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'No se pudo obtener el rendimiento' });
  }
});

module.exports = router;
