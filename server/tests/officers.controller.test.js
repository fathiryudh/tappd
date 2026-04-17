'use strict'

const mockPrisma = {
  division: {
    findMany: jest.fn(),
  },
  branch: {
    findMany: jest.fn(),
  },
  officer: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('../src/config/prisma', () => mockPrisma)

const {
  addOfficer,
  getOfficerFormOptions,
  updateOfficer,
  buildOfficerWhere,
} = require('../src/controllers/officers.controller')

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

describe('officers.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('addOfficer maps division and branch names to nested relation writes', async () => {
    const req = {
      user: { sub: 'admin_1' },
      body: {
        phoneNumber: '+65 9109 0213',
        name: 'Denzel Ryan Perera',
        rank: 'CPT',
        role: 'OFFICER',
        division: '2nd Div',
        branch: 'OPS',
      },
    }
    const res = makeRes()
    mockPrisma.officer.create.mockResolvedValue({ id: 'off_1' })

    await addOfficer(req, res)

    expect(mockPrisma.officer.create).toHaveBeenCalledWith({
      data: {
        phoneNumber: '91090213',
        name: 'Denzel Ryan Perera',
        rank: 'CPT',
        role: 'OFFICER',
        admin: { connect: { id: 'admin_1' } },
        division: {
          connectOrCreate: {
            where: { name: '2nd Div' },
            create: { name: '2nd Div' },
          },
        },
        branch: {
          connectOrCreate: {
            where: { name: 'OPS' },
            create: { name: 'OPS' },
          },
        },
      },
      include: { division: true, branch: true },
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'off_1' })
  })

  test('getOfficerFormOptions returns divisions and branches ordered by name', async () => {
    const req = { user: { sub: 'admin_1' } }
    const res = makeRes()
    mockPrisma.division.findMany.mockResolvedValue([{ id: 'div_1', name: '2nd Div' }])
    mockPrisma.branch.findMany.mockResolvedValue([{ id: 'br_1', name: 'OPS' }])

    await getOfficerFormOptions(req, res)

    expect(mockPrisma.division.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    expect(res.json).toHaveBeenCalledWith({
      divisions: [{ id: 'div_1', name: '2nd Div' }],
      branches: [{ id: 'br_1', name: 'OPS' }],
    })
  })

  test('updateOfficer clears relations when divisionId and branchId are blank', async () => {
    const req = {
      user: { sub: 'admin_1' },
      params: { id: 'off_1' },
      body: {
        phoneNumber: '9876 5432',
        divisionId: '',
        branchId: '',
      },
    }
    const res = makeRes()
    mockPrisma.officer.findFirst.mockResolvedValue({ id: 'off_1', adminId: 'admin_1' })
    mockPrisma.officer.update.mockResolvedValue({ id: 'off_1' })

    await updateOfficer(req, res)

    expect(mockPrisma.officer.update).toHaveBeenCalledWith({
      where: { id: 'off_1' },
      data: {
        phoneNumber: '98765432',
        telegramId: null,
        telegramName: null,
        division: { disconnect: true },
        branch: { disconnect: true },
      },
      include: { division: true, branch: true },
    })
    expect(res.json).toHaveBeenCalledWith({ id: 'off_1' })
  })

  test('buildOfficerWhere supports both ids and relation names', async () => {
    await expect(
      buildOfficerWhere('admin_1', {
        division: '2nd Div',
        branchId: 'br_1',
      })
    ).resolves.toEqual({
      adminId: 'admin_1',
      division: { is: { name: '2nd Div' } },
      branchId: 'br_1',
    })
  })
})
