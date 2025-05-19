import { Component, OnInit } from '@angular/core';
import { AdminBoardService, FileCountResponse } from '../admin-board.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto'; // Import Chart.js
import { ChartConfiguration } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';  // Import NgChartsModule directly
@Component({
  selector: 'app-admin-board',
  imports: [CommonModule, FormsModule,BaseChartDirective],
  templateUrl: './admin-board.component.html',
  styleUrl: './admin-board.component.css'
})
export class AdminBoardComponent implements OnInit {
  counts: FileCountResponse | null = null;
  loading = true;
  error: string | null = null;
  totalDatasetPoints = 3200; // Hardcoded as per your HTML
  annotatorUsernames: { [key: string]: string } = {
    annotator3: 'Dr. Priyadarshani',
    annotator4: 'Dr. Sonal',
    annotator5: 'Dr. Afreen',
    annotator6: 'Dr. Monika',
    drannotatorS: 'Dr. Siddharth',
    drannotatorR: 'Dr. Ruchir',
    annotator7: 'Dr. Lavanya',
    annotator8: 'Dr. Avita',
    annotator9: 'Dr. Mohan',

  };
  userDailySaveCounts: any[] = [];
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Date' } },
      y: {
        title: { display: true, text: 'Cumulative Save Count' },
        beginAtZero: true,
        max: 3200 // Set y-axis maximum to 3200
      }
    },
    plugins: {
      legend: { position: 'top' }
    },
    elements: {
      line: { tension: 0.1 } // Ensure smooth lines with gaps
    },
    spanGaps: true // Allow lines to break at null values
  };
  public lineChartLegend = true;

  constructor(private adminBoardService: AdminBoardService,private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchFileCounts();
    this.fetchDailySaveCounts();
  }

  fetchFileCounts(): void {
    this.adminBoardService.getFileCounts().subscribe({
      next: (data: FileCountResponse) => {
        this.counts = data;
        this.loading = false;
        this.renderPieChart();
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  private async loadChartJS() {
    if (!(window as any).Chart) {
      const Chart = await import('chart.js/auto');
      return Chart.default;
    }
    return (window as any).Chart;
  }

  async renderPieChart() {
    const annotatedFiles = this.counts?.annotatedFiles || 0;
    const unannotatedFiles = this.totalDatasetPoints - annotatedFiles;
    const nonRelevantFiles = this.counts?.totalNonRelevantFiles || 0;
    const ctx = (document.getElementById('pieChart') as HTMLCanvasElement).getContext('2d');

    if (ctx) {
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Annotated', 'Unannotated', 'Non-Relevant'],
          datasets: [{
            data: [annotatedFiles, unannotatedFiles, nonRelevantFiles],
            backgroundColor: ['#008000','#FFFF00','#FF6347'], // Green for annotated, gray for unannotated
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Dataset Annotation Breakdown'
            }
          }
        }
      });
    }
  }
  fetchDailySaveCounts() {
    this.adminBoardService.getDailySaveCounts().subscribe(
      (response: any) => {
        if (response.success) {
          this.userDailySaveCounts = response.data;
          this.updateChartData();
        }
      },
      (error) => {
        console.error('Error fetching daily save counts:', error);
      }
    );
  }

  updateChartData() {
    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [];

    // Generate unique colors for each user
    const colors = [
      'rgba(255, 99, 132, 0.8)',    // Red
      'rgba(54, 162, 235, 0.8)',    // Blue
      'rgba(255, 206, 86, 0.8)',    // Yellow
      'rgba(75, 192, 192, 0.8)',    // Teal
      'rgba(153, 102, 255, 0.8)',   // Purple
      'rgba(255, 159, 64, 0.8)',    // Orange
      'rgba(255, 99, 71, 0.8)',     // Tomato
      'rgba(144, 238, 144, 0.8)'    // Light Green
    ];
    const borderColors = colors.map(color => color.replace('0.8', '1')); // Solid border colors

    // Get all unique dates across all users, sorted
    const allDates = this.userDailySaveCounts
      .flatMap(user => user.dailySaveCounts.map((day: any) => day.date))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const uniqueDates = [...new Set(allDates)];

    // Process each user
    this.userDailySaveCounts.forEach((userData, index) => {
      const user = userData.user;
      const dailyCounts = userData.dailySaveCounts.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date
      let cumulativeCount = 0;
      const dataPoints: (number | null)[] = Array(uniqueDates.length).fill(null); // Initialize with null for gaps

      dailyCounts.forEach((day: any) => {
        const dateIndex = uniqueDates.indexOf(day.date);
        if (dateIndex !== -1) {
          cumulativeCount += day.count; // Progressive logic
          dataPoints[dateIndex] = cumulativeCount; // Set the cumulative count at the correct date
        }
      });

      datasets.push({
        label: `${this.annotatorUsernames[user] || user} Progress`,
        data: dataPoints,
        fill: false,
        borderColor: borderColors[index % borderColors.length],
        backgroundColor: colors[index % colors.length],
        tension: 0.1,
        spanGaps: true // Ensure gaps are handled correctly
      });
    });

    this.lineChartData = {
      labels: uniqueDates,
      datasets
    };
  }
}