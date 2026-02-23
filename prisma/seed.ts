import { PrismaClient, GameParticipant, Question } from '@prisma/client';
import { HostRoles } from '../src/repository/contracts/auth.dto';
import * as bcrypt from 'bcryptjs';
import { AnswerStatus } from '../src/repository/contracts/game-engine.dto';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Cleaning up database...');
  await prisma.dispute.deleteMany();
  await prisma.answerStatusHistory.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.round.deleteMany();
  await prisma.gameParticipant.deleteMany();
  await prisma.game.deleteMany();
  await prisma.team.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.answerStatus.deleteMany();
  await prisma.disputeStatus.deleteMany();
  console.log('Database cleared.');
}

async function seedMetadata() {
  console.log('Seeding metadata...');
  await prisma.role.createMany({
    data: [
      { name: HostRoles.HOST },
      { name: HostRoles.ADMIN },
      { name: HostRoles.SCORER },
    ],
  });
  await prisma.answerStatus.createMany({
    data: [
      { name: AnswerStatus.UNSET },
      { name: AnswerStatus.CORRECT },
      { name: AnswerStatus.INCORRECT },
      { name: AnswerStatus.DISPUTABLE },
    ],
  });
  await prisma.disputeStatus.createMany({
    data: [{ name: 'OPEN' }, { name: 'REVIEWING' }, { name: 'RESOLVED' }],
  });
}

async function seedTestData() {
  console.log('Seeding extended test data...');

  const hostRole = await prisma.role.findFirst({
    where: { name: HostRoles.HOST },
  });
  const hashedPassword = await bcrypt.hash('password123', 10);

  const host = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: hashedPassword,
      roleId: hostRole!.id,
    },
  });

  const category = await prisma.category.create({
    data: { name: 'General Knowledge', userId: host.id },
  });

  const game = await prisma.game.create({
    data: {
      hostId: host.id,
      name: 'Championship Test Game',
      passcode: 111222,
      status: 'PREPARING',
      date: new Date(),
    },
  });

  const teamNames = ['Alpha Team', 'Beta Team', 'Gamma Team'];
  const participants: GameParticipant[] = [];
  const questions: Question[] = [];

  for (const name of teamNames) {
    const team = await prisma.team.create({
      data: { name, teamCode: `${name.split(' ')[0].toUpperCase()}_CODE`, managerId: host.id},
    });

    const participant = await prisma.gameParticipant.create({
      data: {
        gameId: game.id,
        teamId: team.id,
        categoryId: category.id,
      },
    });
    participants.push(participant);
  }

  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      roundNumber: 1,
      name: 'Qualifying Round',
    },
  });

  const questionsData = [
    { text: 'What is the capital of Japan?', answer: 'Tokyo' },
    { text: 'Who wrote "1984"?', answer: 'George Orwell' },
    { text: 'Which planet is known as the Red Planet?', answer: 'Mars' },
  ];

  for (let i = 0; i < questionsData.length; i++) {
    const q = await prisma.question.create({
      data: {
        roundId: round.id,
        questionNumber: i + 1,
        text: questionsData[i].text,
        answer: questionsData[i].answer,
        timeToThink: 60,
        timeToAnswer: 10,
      },
    });
    questions.push(q);
  }

  console.log(`
  ======= TEST DATA READY =======
  Host Login: admin@test.com / password123
  Game ID:    ${game.id}
  
  PARTICIPANTS (Use these for player.html):
  - ${teamNames[0]}: ID ${participants[0].id}
  - ${teamNames[1]}: ID ${participants[1].id}
  - ${teamNames[2]}: ID ${participants[2].id}

  QUESTIONS (Use these for admin.html):
  - Q1 ID: ${questions[0].id} ("${questions[0].text}")
  - Q2 ID: ${questions[1].id} ("${questions[1].text}")
  - Q3 ID: ${questions[2].id} ("${questions[2].text}")
  ===============================
  `);
}

async function main() {
  await clearDatabase();
  await seedMetadata();
  await seedTestData();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
