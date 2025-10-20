import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Challenge, ChallengeDocument } from './entities/challenge.entity';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectModel(Challenge.name)
    private readonly challengeModel: Model<ChallengeDocument>,
  ) {}

  // 🔹 Real bugungi sanani olish
  private getRealToday(): string {
    const serverNow = new Date();

    // Server vaqtini tuzatish
    if (serverNow.toISOString().split('T')[0] === '2025-10-18') {
      const correctedDate = new Date(serverNow);
      correctedDate.setDate(correctedDate.getDate() + 1);
      return correctedDate.toISOString().split('T')[0];
    }

    return serverNow.toISOString().split('T')[0];
  }

  // 🔹 Asosiy CRUD operatsiyalari
  async findAll(userId: string): Promise<Challenge[]> {
    return this.challengeModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<ChallengeDocument> {
    const challenge = await this.challengeModel.findOne({ _id: id, userId }).exec();
    if (!challenge) throw new NotFoundException('Challenge not found or not yours');
    return challenge;
  }

  async create(dto: CreateChallengeDto, userId: string): Promise<Challenge> {
    return this.challengeModel.create({
      ...dto,
      userId,
      status: 'draft',
      progress: 0,
    });
  }

  async update(id: string, dto: UpdateChallengeDto, userId: string): Promise<Challenge> {
    const updated = await this.challengeModel
      .findOneAndUpdate({ _id: id, userId }, dto, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Challenge not found or not yours');
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.challengeModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!result) throw new NotFoundException('Challenge not found or not yours');
  }

  // 🔹 Challenge boshqaruvi
  async start(id: string, userId: string): Promise<Challenge> {
    const challenge = await this.findOne(id, userId);

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + challenge.duration * 24 * 60 * 60 * 1000);

    await this.challengeModel.updateOne(
      { _id: id, userId },
      {
        $set: {
          status: 'active',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      },
    );

    await this.createAllTracksForChallenge(id, userId, startDate, challenge.duration);
    return this.findOne(id, userId);
  }

  async stop(id: string, userId: string): Promise<Challenge> {
    await this.challengeModel.updateOne(
      { _id: id, userId },
      {
        $set: {
          status: 'draft',
          startDate: null,
          endDate: null,
        },
      },
    );

    return this.findOne(id, userId);
  }

  async complete(id: string, userId: string): Promise<Challenge> {
    await this.challengeModel.updateOne(
      { _id: id, userId },
      {
        $set: {
          status: 'completed',
          progress: 100,
        },
      },
    );

    return this.findOne(id, userId);
  }

  async restart(id: string, userId: string): Promise<Challenge> {
    const original = await this.findOne(id, userId);

    if (original.status !== 'completed') {
      throw new ForbiddenException('Only completed challenges can be restarted');
    }

    const newChallenge = await this.challengeModel.create({
      name: original.name,
      duration: original.duration,
      tasks: original.tasks,
      penalty: original.penalty,
      status: 'draft',
      progress: 0,
      userId,
      restartedFrom: id,
      dailyResults: {},
      startDate: null,
      endDate: null,
    });

    return newChallenge;
  }

  // 🔹 Kunlik track boshqaruvi
  async createTodayTrack(userId: string): Promise<any> {
    return await this.findTodayTrack(userId);
  }

  async findTodayTrack(userId: string): Promise<any[]> {
    const today = this.getRealToday();

    const activeChallenges = await this.challengeModel.find({
      userId,
      status: 'active'
    });

    if (activeChallenges.length === 0) {
      throw new NotFoundException('No active challenges found');
    }

    const allTodayTracks: any[] = [];

    for (const challenge of activeChallenges) {
      const todayTrack = challenge.dailyTracks.find(track => track.date === today);

      if (!todayTrack) {
        continue;
      }

      const trackResult = {
        challengeId: challenge._id.toString(),
        challengeName: challenge.name,
        date: today,
        tasks: todayTrack.tasks,
        completedTasks: todayTrack.completedTasks,
        totalTasks: todayTrack.totalTasks,
        progress: todayTrack.progress,
        dayCompleted: todayTrack.dayCompleted,
        penalty: todayTrack.penalty,
        successMessage: todayTrack.successMessage
      };

      allTodayTracks.push(trackResult);
    }

    if (allTodayTracks.length === 0) {
      throw new NotFoundException('No tracks found for today');
    }

    return allTodayTracks;
  }

  async toggleTask(userId: string, taskIndex: number): Promise<any> {
    const today = this.getRealToday();

    const challenge = await this.challengeModel.findOne({
      userId,
      status: 'active'
    });

    if (!challenge) {
      throw new NotFoundException('No active challenge found');
    }

    const trackIndex = challenge.dailyTracks.findIndex(track => track.date === today);

    if (trackIndex === -1) {
      throw new NotFoundException('Today track not found. Please start challenge first.');
    }

    if (challenge.dailyTracks[trackIndex].dayCompleted) {
      throw new ForbiddenException('Cannot modify tasks for a completed day');
    }

    if (taskIndex < 0 || taskIndex >= challenge.dailyTracks[trackIndex].tasks.length) {
      throw new NotFoundException('Task not found');
    }

    challenge.dailyTracks[trackIndex].tasks[taskIndex].completed =
      !challenge.dailyTracks[trackIndex].tasks[taskIndex].completed;

    const completedTasks = challenge.dailyTracks[trackIndex].tasks.filter(task => task.completed).length;
    const totalTasks = challenge.dailyTracks[trackIndex].tasks.length;
    const progress = Math.round((completedTasks / totalTasks) * 100);

    challenge.dailyTracks[trackIndex].completedTasks = completedTasks;
    challenge.dailyTracks[trackIndex].totalTasks = totalTasks;
    challenge.dailyTracks[trackIndex].progress = progress;

    await challenge.save();

    const todayTrack = challenge.dailyTracks[trackIndex];

    return {
      challengeId: challenge._id.toString(),
      challengeName: challenge.name,
      date: today,
      tasks: todayTrack.tasks,
      completedTasks: todayTrack.completedTasks,
      totalTasks: todayTrack.totalTasks,
      progress: todayTrack.progress,
      dayCompleted: todayTrack.dayCompleted,
      penalty: todayTrack.penalty,
      successMessage: todayTrack.successMessage
    };
  }

  async toggleTaskById(userId: string, taskId: string): Promise<any> {
    const today = this.getRealToday();

    const activeChallenges = await this.challengeModel.find({
      userId,
      status: 'active'
    });

    if (activeChallenges.length === 0) {
      throw new NotFoundException('No active challenge found');
    }

    for (const challenge of activeChallenges) {
      const trackIndex = challenge.dailyTracks.findIndex(track => track.date === today);

      if (trackIndex === -1) {
        continue;
      }

      if (challenge.dailyTracks[trackIndex].dayCompleted) {
        throw new ForbiddenException('Cannot modify tasks for a completed day');
      }

      const taskIndex = challenge.dailyTracks[trackIndex].tasks.findIndex(
        task => {
          if (task._id && task._id.toString() === taskId) {
            return true;
          }
          return task.task === taskId;
        }
      );

      if (taskIndex !== -1) {
        challenge.dailyTracks[trackIndex].tasks[taskIndex].completed =
          !challenge.dailyTracks[trackIndex].tasks[taskIndex].completed;

        const completedTasks = challenge.dailyTracks[trackIndex].tasks.filter(task => task.completed).length;
        const totalTasks = challenge.dailyTracks[trackIndex].tasks.length;
        const progress = Math.round((completedTasks / totalTasks) * 100);

        challenge.dailyTracks[trackIndex].completedTasks = completedTasks;
        challenge.dailyTracks[trackIndex].totalTasks = totalTasks;
        challenge.dailyTracks[trackIndex].progress = progress;

        await challenge.save();

        const todayTrack = challenge.dailyTracks[trackIndex];

        return {
          challengeId: challenge._id.toString(),
          challengeName: challenge.name,
          date: today,
          tasks: todayTrack.tasks,
          completedTasks: todayTrack.completedTasks,
          totalTasks: todayTrack.totalTasks,
          progress: todayTrack.progress,
          dayCompleted: todayTrack.dayCompleted,
          penalty: todayTrack.penalty,
          successMessage: todayTrack.successMessage
        };
      }
    }

    throw new NotFoundException('Task not found');
  }

  async endDay(userId: string, penalty?: string, successMessage?: string): Promise<any[]> {
    const today = this.getRealToday();

    const activeChallenges = await this.challengeModel.find({
      userId,
      status: 'active'
    });

    if (activeChallenges.length === 0) {
      throw new NotFoundException('No active challenges found');
    }

    const results: any[] = [];

    for (const challenge of activeChallenges) {
      const trackIndex = challenge.dailyTracks.findIndex(track => track.date === today);

      if (trackIndex === -1) {
        continue;
      }

      const allCompleted = challenge.dailyTracks[trackIndex].tasks.every(task => task.completed);

      challenge.dailyTracks[trackIndex].dayCompleted = true;

      if (!allCompleted && penalty) {
        challenge.dailyTracks[trackIndex].penalty = penalty;
      } else if (allCompleted) {
        challenge.dailyTracks[trackIndex].penalty = undefined;
      }

      if (allCompleted && successMessage) {
        challenge.dailyTracks[trackIndex].successMessage = successMessage;
      } else if (!allCompleted) {
        challenge.dailyTracks[trackIndex].successMessage = undefined;
      }

      const savedChallenge = await challenge.save();
      const todayTrack = savedChallenge.dailyTracks[trackIndex];

      const result = {
        challengeId: savedChallenge._id.toString(),
        challengeName: savedChallenge.name,
        date: today,
        tasks: todayTrack.tasks,
        completedTasks: todayTrack.completedTasks,
        totalTasks: todayTrack.totalTasks,
        progress: todayTrack.progress,
        dayCompleted: todayTrack.dayCompleted,
        penalty: todayTrack.penalty,
        successMessage: todayTrack.successMessage
      };

      results.push(result);
    }

    if (results.length === 0) {
      throw new NotFoundException('No today tracks found for any active challenges');
    }

    return results;
  }

  // 🔹 Dashboard ma'lumotlari
  async getDashboardData(userId: string): Promise<any> {
    const challenges = await this.challengeModel.find({ userId }).exec();

    const activeChallenges = challenges.filter(c => c.status === 'active');

    if (activeChallenges.length === 0) {
      return this.getEmptyDashboardData();
    }

    // createdAt dan foydalanamiz
    const currentChallenge = activeChallenges.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    const today = this.getRealToday();
    const todayTrack = currentChallenge.dailyTracks.find(track => track.date === today);

    const completedTracks = currentChallenge.dailyTracks.filter(track => track.dayCompleted).length;
    const totalTracks = currentChallenge.dailyTracks.length;
    const challengeProgress = totalTracks > 0 ? Math.round((completedTracks / totalTracks) * 100) : 0;

    let dayNumber = 1;
    if (currentChallenge.startDate) {
      const startDate = new Date(currentChallenge.startDate);
      const currentDate = new Date();
      dayNumber = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      dayNumber = Math.min(Math.max(dayNumber, 1), currentChallenge.duration);
    }

    const { currentStreak, bestStreak } = await this.calculateStreaks(userId);
    const { successRate } = await this.calculateSuccessMetrics(userId);

    const todaysTasks = todayTrack ? todayTrack.tasks.map((task, index) => ({
      id: task._id ? task._id.toString() : `task-${index}`,
      task: task.task,
      completed: task.completed
    })) : [];

    const motivationalQuotes = [
      "Discipline is the bridge between goals and accomplishment.",
      "Success is the sum of small efforts repeated day in and day out.",
      "The pain of discipline weighs ounces, but the pain of regret weighs tons.",
      "Champions don't become champions in the ring. They become champions in their training.",
      "Every day, in every way, I'm getting better and better.",
      "Small daily improvements are the key to staggering long-term results.",
      "You'll never change your life until you change something you do daily.",
      "The only way to do great work is to love what you do."
    ];

    const todaysQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

    return {
      currentChallenge: {
        id: currentChallenge._id.toString(),
        name: currentChallenge.name,
        day: dayNumber,
        totalDays: currentChallenge.duration,
        progress: challengeProgress,
        tasksToday: todaysTasks.length,
        completedToday: todaysTasks.filter(task => task.completed).length,
        startDate: currentChallenge.startDate,
        todayTrackExists: !!todayTrack
      },
      todaysTasks,
      stats: {
        currentStreak,
        bestStreak,
        totalChallenges: challenges.length,
        completedChallenges: challenges.filter(c => c.status === 'completed').length,
        successRate: Math.round(successRate)
      },
      todaysQuote,
      hasActiveChallenge: true
    };
  }

  // 🔹 Progress overview ma'lumotlari
  async getProgressOverview(userId: string): Promise<any> {
    const challenges = await this.challengeModel.find({ userId }).exec();

    if (challenges.length === 0) {
      return this.getEmptyProgressStats();
    }

    const totalChallenges = challenges.length;
    const completedChallenges = challenges.filter(c => c.status === 'completed').length;

    const { currentStreak, bestStreak } = await this.calculateStreaks(userId);
    const { totalDays, successRate, averageTasksPerDay } = await this.calculateSuccessMetrics(userId);

    const weeklyData = await this.getWeeklyPerformance(userId);
    const monthlyProgress = await this.getMonthlyTrends(userId);
    const achievements = await this.getUserAchievements(userId, challenges);
    const challengeHistory = await this.getChallengeHistory(userId);

    return {
      stats: {
        totalChallenges,
        completedChallenges,
        currentStreak,
        bestStreak,
        totalDays,
        successRate: Math.round(successRate),
        averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10
      },
      weeklyData,
      monthlyProgress,
      achievements,
      challengeHistory
    };
  }

  // 🔹 Streak hisoblash
  private async calculateStreaks(userId: string): Promise<{ currentStreak: number; bestStreak: number }> {
    const challenges = await this.challengeModel.find({ userId }).exec();

    const allTracks = challenges.flatMap(challenge =>
      challenge.dailyTracks.map(track => ({
        date: track.date,
        progress: track.progress,
        dayCompleted: track.dayCompleted
      }))
    );

    const dailyProgress = new Map<string, number>();

    allTracks.forEach(track => {
      const currentMax = dailyProgress.get(track.date) || 0;
      if (track.progress > currentMax) {
        dailyProgress.set(track.date, track.progress);
      }
    });

    const sortedDates = Array.from(dailyProgress.keys()).sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    let bestStreak = 0;

    const today = this.getRealToday();

    for (const date of sortedDates) {
      const progress = dailyProgress.get(date)!;

      if (progress >= 80) {
        currentStreak++;
      } else {
        break;
      }
    }

    const allDatesSorted = Array.from(dailyProgress.keys()).sort((a, b) => a.localeCompare(b));

    let tempStreak = 0;
    for (let i = 0; i < allDatesSorted.length; i++) {
      const date = allDatesSorted[i];
      const progress = dailyProgress.get(date)!;

      if (progress >= 80) {
        tempStreak++;
        if (i === allDatesSorted.length - 1) {
          bestStreak = Math.max(bestStreak, tempStreak);
        }
      } else {
        bestStreak = Math.max(bestStreak, tempStreak);
        tempStreak = 0;
      }
    }

    return {
      currentStreak: Math.max(currentStreak, 0),
      bestStreak: Math.max(bestStreak, 0)
    };
  }

  // 🔹 Muvaffaqiyat metrikalari
  private async calculateSuccessMetrics(userId: string): Promise<{
    totalDays: number;
    successRate: number;
    averageTasksPerDay: number
  }> {
    const challenges = await this.challengeModel.find({ userId }).exec();

    const allUniqueDates = new Set<string>();
    const allTracks = challenges.flatMap(challenge => challenge.dailyTracks);

    allTracks.forEach(track => {
      allUniqueDates.add(track.date);
    });

    const totalDays = allUniqueDates.size;

    if (totalDays === 0) {
      return { totalDays: 0, successRate: 0, averageTasksPerDay: 0 };
    }

    const successfulDates = new Set<string>();
    allTracks.forEach(track => {
      if (track.progress >= 80) {
        successfulDates.add(track.date);
      }
    });

    const successRate = (successfulDates.size / totalDays) * 100;
    const totalTasks = allTracks.reduce((sum, track) => sum + track.tasks.length, 0);
    const averageTasksPerDay = totalTasks / totalDays;

    return {
      totalDays,
      successRate: Math.round(successRate),
      averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10
    };
  }

  // 🔹 Haftalik performans
  private async getWeeklyPerformance(userId: string): Promise<any[]> {
    const challenges = await this.challengeModel.find({ userId }).exec();
    const allTracks = challenges.flatMap(challenge => challenge.dailyTracks);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData: any[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];

      const dayTracks = allTracks.filter(track => track.date === dateString);

      if (dayTracks.length > 0) {
        const totalTasks = dayTracks.reduce((sum, track) => sum + track.tasks.length, 0);
        const completedTasks = dayTracks.reduce((sum, track) => sum + track.completedTasks, 0);
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        weeklyData.push({
          day: dayName,
          completed: completedTasks,
          total: totalTasks,
          percentage
        });
      } else {
        weeklyData.push({
          day: dayName,
          completed: 0,
          total: 0,
          percentage: 0
        });
      }
    }

    return weeklyData;
  }

  // 🔹 Oylik trendlar
  private async getMonthlyTrends(userId: string): Promise<any[]> {
    const challenges = await this.challengeModel.find({ userId }).exec();
    const allTracks = challenges.flatMap(challenge => challenge.dailyTracks);

    const monthlyData: { [key: string]: { total: number; completed: number } } = {};

    allTracks.forEach(track => {
      const month = track.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { total: 0, completed: 0 };
      }
      monthlyData[month].total++;
      if (track.dayCompleted) {
        monthlyData[month].completed++;
      }
    });

    const months: any[] = [];
    for (let i = 3; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7);
      const monthName = date.toLocaleString('default', { month: 'short' });

      const data = monthlyData[monthKey];
      const success = data ? Math.round((data.completed / data.total) * 100) : 0;

      months.push({
        month: monthName,
        success
      });
    }

    return months;
  }

  // 🔹 Foydalanuvchi yutuqlari
  private async getUserAchievements(userId: string, challenges: ChallengeDocument[]): Promise<any[]> {
    const achievements: any[] = [];

    const { currentStreak, bestStreak } = await this.calculateStreaks(userId);
    const totalChallenges = challenges.length;
    const completedChallenges = challenges.filter(c => c.status === 'completed').length;
    const activeChallenges = challenges.filter(c => c.status === 'active').length;

    // 1. First Steps
    if (completedChallenges > 0) {
      const firstCompleted = challenges
        .filter(c => c.status === 'completed')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      achievements.push({
        id: 1,
        name: "First Steps",
        description: "Complete your first challenge",
        icon: "ri-footprint-line",
        earned: true,
        date: firstCompleted?.createdAt ? new Date(firstCompleted.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      achievements.push({
        id: 1,
        name: "First Steps",
        description: "Complete your first challenge",
        icon: "ri-footprint-line",
        earned: false
      });
    }

    // 2. Consistency King
    if (currentStreak >= 7) {
      const achievementDate = await this.getStreakAchievementDate(userId, 7);
      achievements.push({
        id: 2,
        name: "Consistency King",
        description: "7-day streak",
        icon: "ri-fire-line",
        earned: true,
        date: achievementDate
      });
    } else {
      achievements.push({
        id: 2,
        name: "Consistency King",
        description: "7-day streak",
        icon: "ri-fire-line",
        earned: false
      });
    }

    // 3. Focus Master
    const focusChallenges = challenges.filter(c =>
      c.name.toLowerCase().includes('focus') && c.status === 'completed'
    );
    if (focusChallenges.length > 0) {
      const latestFocus = focusChallenges.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      achievements.push({
        id: 3,
        name: "Focus Master",
        description: "Complete Focus Challenge",
        icon: "ri-focus-3-line",
        earned: true,
        date: latestFocus.createdAt ? new Date(latestFocus.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      achievements.push({
        id: 3,
        name: "Focus Master",
        description: "Complete Focus Challenge",
        icon: "ri-focus-3-line",
        earned: false
      });
    }

    // 4. Iron Will
    if (bestStreak >= 30) {
      const achievementDate = await this.getStreakAchievementDate(userId, 30);
      achievements.push({
        id: 4,
        name: "Iron Will",
        description: "30-day streak",
        icon: "ri-shield-line",
        earned: true,
        date: achievementDate
      });
    } else {
      achievements.push({
        id: 4,
        name: "Iron Will",
        description: "30-day streak",
        icon: "ri-shield-line",
        earned: false
      });
    }

    // 5. Discipline Warrior
    if (completedChallenges >= 5) {
      const fifthCompleted = challenges
        .filter(c => c.status === 'completed')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[4];

      achievements.push({
        id: 5,
        name: "Discipline Warrior",
        description: "Complete 5 challenges",
        icon: "ri-sword-line",
        earned: true,
        date: fifthCompleted?.createdAt ? new Date(fifthCompleted.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      achievements.push({
        id: 5,
        name: "Discipline Warrior",
        description: "Complete 5 challenges",
        icon: "ri-sword-line",
        earned: false
      });
    }

    // 6. Legendary
    if (bestStreak >= 100) {
      const achievementDate = await this.getStreakAchievementDate(userId, 100);
      achievements.push({
        id: 6,
        name: "Legendary",
        description: "100-day streak",
        icon: "ri-trophy-line",
        earned: true,
        date: achievementDate
      });
    } else {
      achievements.push({
        id: 6,
        name: "Legendary",
        description: "100-day streak",
        icon: "ri-trophy-line",
        earned: false
      });
    }

    // 7. Challenge Starter
    if (totalChallenges > 0) {
      const firstChallenge = challenges.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];

      achievements.push({
        id: 7,
        name: "Challenge Starter",
        description: "Start your first challenge",
        icon: "ri-flag-line",
        earned: true,
        date: firstChallenge.createdAt ? new Date(firstChallenge.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      achievements.push({
        id: 7,
        name: "Challenge Starter",
        description: "Start your first challenge",
        icon: "ri-flag-line",
        earned: false
      });
    }

    // 8. Multi-Tasker
    if (activeChallenges >= 3) {
      achievements.push({
        id: 8,
        name: "Multi-Tasker",
        description: "3 active challenges simultaneously",
        icon: "ri-list-check",
        earned: true,
        date: new Date().toISOString().split('T')[0]
      });
    } else {
      achievements.push({
        id: 8,
        name: "Multi-Tasker",
        description: "3 active challenges simultaneously",
        icon: "ri-list-check",
        earned: false
      });
    }

    return achievements.sort((a, b) => a.id - b.id);
  }

  // 🔹 Challenge tarixi
  private async getChallengeHistory(userId: string): Promise<any[]> {
    const challenges = await this.challengeModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    const history: any[] = [];

    challenges.forEach(challenge => {
      let status: string;
      let statusIcon: string;
      let statusColor: string;

      switch (challenge.status) {
        case 'completed':
          status = 'Completed';
          statusIcon = 'ri-checkbox-circle-fill';
          statusColor = 'emerald';
          break;
        case 'active':
          status = 'In Progress';
          statusIcon = 'ri-play-circle-line';
          statusColor = 'cyan';
          break;
        default:
          status = 'Draft';
          statusIcon = 'ri-draft-line';
          statusColor = 'yellow';
          break;
      }

      let progress = 0;

      if (challenge.status === 'completed') {
        progress = 100;
      } else if (challenge.status === 'active' && challenge.dailyTracks.length > 0) {
        const completedTracks = challenge.dailyTracks.filter(track => track.dayCompleted);
        progress = Math.round((completedTracks.length / challenge.dailyTracks.length) * 100);
      }

      let startDate = challenge.startDate;
      let endDate = challenge.endDate;

      if (challenge.status === 'active' && !startDate && challenge.dailyTracks.length > 0) {
        const sortedTracks = [...challenge.dailyTracks].sort((a, b) => a.date.localeCompare(b.date));
        startDate = sortedTracks[0]?.date;

        if (challenge.duration && startDate) {
          const start = new Date(startDate);
          const end = new Date(start.getTime() + challenge.duration * 24 * 60 * 60 * 1000);
          endDate = end.toISOString().split('T')[0];
        }
      }

      history.push({
        id: challenge._id.toString(),
        name: challenge.name,
        status,
        statusIcon,
        statusColor,
        progress,
        startDate,
        endDate
      });
    });

    return history;
  }

  // 🔹 Yordamchi metodlar
  private async createAllTracksForChallenge(challengeId: string, userId: string, startDate: Date, duration: number): Promise<void> {
    const challenge = await this.findOne(challengeId, userId);

    for (let i = 0; i < duration; i++) {
      const trackDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateString = trackDate.toISOString().split('T')[0];

      const existingTrack = challenge.dailyTracks.find(track => track.date === dateString);

      if (!existingTrack) {
        const trackTasks = challenge.tasks.map(task => ({
          task: task,
          completed: false,
          motivation: this.generateMotivation(task),
        }));

        const newTrack = {
          date: dateString,
          tasks: trackTasks,
          completedTasks: 0,
          totalTasks: trackTasks.length,
          progress: 0,
          dayCompleted: false,
        };

        challenge.dailyTracks.push(newTrack);
      }
    }

    await challenge.save();
  }

  private async getStreakAchievementDate(userId: string, targetStreak: number): Promise<string> {
    const challenges = await this.challengeModel.find({ userId }).exec();

    const allTracks = challenges.flatMap(challenge =>
      challenge.dailyTracks.map(track => ({
        date: track.date,
        progress: track.progress
      }))
    ).sort((a, b) => a.date.localeCompare(b.date));

    const dailyProgress = new Map<string, number>();
    allTracks.forEach(track => {
      const currentMax = dailyProgress.get(track.date) || 0;
      if (track.progress > currentMax) {
        dailyProgress.set(track.date, track.progress);
      }
    });

    const sortedDates = Array.from(dailyProgress.keys()).sort((a, b) => a.localeCompare(b));

    let currentStreak = 0;
    let achievementDate = new Date().toISOString().split('T')[0];

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const progress = dailyProgress.get(date)!;

      if (progress >= 80) {
        currentStreak++;

        if (currentStreak === targetStreak) {
          achievementDate = date;
          break;
        }
      } else {
        currentStreak = 0;
      }
    }

    return achievementDate;
  }

  private getEmptyDashboardData() {
    const motivationalQuotes = [
      "Discipline is the bridge between goals and accomplishment.",
      "Success is the sum of small efforts repeated day in and day out.",
      "The pain of discipline weighs ounces, but the pain of regret weighs tons.",
      "Every day, in every way, I'm getting better and better."
    ];

    const todaysQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

    return {
      currentChallenge: null,
      todaysTasks: [],
      stats: {
        currentStreak: 0,
        bestStreak: 0,
        totalChallenges: 0,
        completedChallenges: 0,
        successRate: 0
      },
      todaysQuote,
      hasActiveChallenge: false
    };
  }

  private getEmptyProgressStats() {
    return {
      stats: {
        totalChallenges: 0,
        completedChallenges: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalDays: 0,
        successRate: 0,
        averageTasksPerDay: 0
      },
      weeklyData: [
        { day: 'Mon', completed: 0, total: 0, percentage: 0 },
        { day: 'Tue', completed: 0, total: 0, percentage: 0 },
        { day: 'Wed', completed: 0, total: 0, percentage: 0 },
        { day: 'Thu', completed: 0, total: 0, percentage: 0 },
        { day: 'Fri', completed: 0, total: 0, percentage: 0 },
        { day: 'Sat', completed: 0, total: 0, percentage: 0 },
        { day: 'Sun', completed: 0, total: 0, percentage: 0 }
      ],
      monthlyProgress: [
        { month: 'Jan', success: 0 },
        { month: 'Feb', success: 0 },
        { month: 'Mar', success: 0 },
        { month: 'Apr', success: 0 }
      ],
      achievements: [
        { id: 1, name: "First Steps", description: "Complete your first challenge", icon: "ri-footprint-line", earned: false },
        { id: 2, name: "Consistency King", description: "7-day streak", icon: "ri-fire-line", earned: false },
        { id: 3, name: "Focus Master", description: "Complete Focus Challenge", icon: "ri-focus-3-line", earned: false },
        { id: 4, name: "Iron Will", description: "30-day streak", icon: "ri-shield-line", earned: false },
        { id: 5, name: "Discipline Warrior", description: "Complete 5 challenges", icon: "ri-sword-line", earned: false },
        { id: 6, name: "Legendary", description: "100-day streak", icon: "ri-trophy-line", earned: false }
      ],
      challengeHistory: []
    };
  }

  private generateMotivation(task: string): string {
    const motivations = [
      'Stay focused, stay present',
      'Consistency is key to success',
      'Every small step counts',
      'You are building better habits',
      'Discipline equals freedom',
      'Progress, not perfection',
      'You have got this!',
      'Small daily improvements lead to big results',
    ];
    return motivations[Math.floor(Math.random() * motivations.length)];
  }

  // 🔹 Qo'shimcha metodlar (mavjud)
  async getProgressStats(userId: string, days = 7): Promise<any> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const challenges = await this.challengeModel.find({
      userId,
      status: 'active',
    });

    if (challenges.length === 0) {
      return {
        totalTracks: 0,
        completedTracks: 0,
        averageProgress: 0,
        bestDay: null,
        streak: 0,
      };
    }

    const allTracks = challenges.flatMap(challenge =>
      challenge.dailyTracks.filter(track =>
        track.date >= startDate && track.date <= endDate
      )
    );

    if (allTracks.length === 0) {
      return {
        totalTracks: 0,
        completedTracks: 0,
        averageProgress: 0,
        bestDay: null,
        streak: 0,
      };
    }

    const totalTracks = allTracks.length;
    const completedTracks = allTracks.filter(track => track.dayCompleted).length;
    const averageProgress = Math.round(
      allTracks.reduce((sum, track) => sum + track.progress, 0) / totalTracks,
    );

    const bestDay = allTracks.reduce(
      (best, track) => {
        return track.progress > (best?.progress || 0)
          ? { date: track.date, progress: track.progress }
          : best;
      },
      null as { date: string; progress: number } | null,
    );

    let streak = 0;
    const sortedTracks = [...allTracks].sort((a, b) => b.date.localeCompare(a.date));

    for (const track of sortedTracks) {
      if (track.dayCompleted) {
        streak++;
      } else {
        break;
      }
    }

    return {
      totalTracks,
      completedTracks,
      averageProgress,
      bestDay,
      streak,
    };
  }

  async fixTimeIssues(userId: string): Promise<{ realToday: string; challengesFixed: number; tracksCreated: number }> {
    const realToday = this.getRealToday();

    const activeChallenges = await this.challengeModel.find({
      userId,
      status: 'active'
    });

    const results = {
      realToday: realToday,
      challengesFixed: 0,
      tracksCreated: 0
    };

    for (const challenge of activeChallenges) {
      const todayTrackIndex = challenge.dailyTracks.findIndex(track => track.date === realToday);

      if (todayTrackIndex === -1) {
        const trackTasks = challenge.tasks.map(task => ({
          task: task,
          completed: false,
          motivation: this.generateMotivation(task),
        }));

        const newTodayTrack = {
          date: realToday,
          tasks: trackTasks,
          completedTasks: 0,
          totalTasks: trackTasks.length,
          progress: 0,
          dayCompleted: false,
        };

        challenge.dailyTracks.push(newTodayTrack);
        await challenge.save();
        results.tracksCreated++;
        results.challengesFixed++;
      }
    }

    return results;
  }

  async getChallengeTracks(id: string, userId: string): Promise<any> {
    const challenge = await this.findOne(id, userId);

    return {
      challengeId: challenge._id.toString(),
      challengeName: challenge.name,
      totalTracks: challenge.dailyTracks.length,
      tracks: challenge.dailyTracks.map(track => ({
        date: track.date,
        tasks: track.tasks.length,
        completedTasks: track.completedTasks,
        progress: track.progress,
        dayCompleted: track.dayCompleted
      })).sort((a, b) => b.date.localeCompare(a.date))
    };
  }

  async createAllTracksForChallengeDebug(id: string, userId: string): Promise<any> {
    const challenge = await this.findOne(id, userId);

    if (!challenge.startDate) {
      throw new ForbiddenException('Challenge not started');
    }

    const startDate = new Date(challenge.startDate);
    const duration = challenge.duration;

    let created = 0;
    for (let i = 0; i < duration; i++) {
      const trackDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateString = trackDate.toISOString().split('T')[0];

      const existingTrack = challenge.dailyTracks.find(track => track.date === dateString);

      if (!existingTrack) {
        const trackTasks = challenge.tasks.map(task => ({
          task: task,
          completed: false,
          motivation: this.generateMotivation(task),
        }));

        const newTrack = {
          date: dateString,
          tasks: trackTasks,
          completedTasks: 0,
          totalTasks: trackTasks.length,
          progress: 0,
          dayCompleted: false,
        };

        challenge.dailyTracks.push(newTrack);
        created++;
      }
    }

    await challenge.save();

    return {
      message: `Created ${created} new tracks`,
      totalTracks: challenge.dailyTracks.length,
      challenge: challenge.name
    };
  }
}