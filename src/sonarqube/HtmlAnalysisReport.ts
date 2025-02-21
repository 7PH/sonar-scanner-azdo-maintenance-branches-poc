import * as tl from "azure-pipelines-task-lib/task";
import {
  htmlDiv,
  htmlLink,
  htmlMainDiv,
  htmlMetricList,
  htmlMetricListItem,
  htmlQualityGateHeader,
  htmlSectionDiv,
  htmlSeparator,
} from "../helpers/html";
import { formatMeasure } from "../helpers/measures";
import { AnalysisResult, Measure, ProjectStatus } from "./types";

export default class HtmlAnalysisReport {
  private readonly projectStatus: ProjectStatus;
  private readonly measures: Measure[];
  private readonly result: AnalysisResult;

  public static getInstance(
    projectStatus: ProjectStatus,
    measures: Measure[],
    result: AnalysisResult,
  ): HtmlAnalysisReport {
    return new HtmlAnalysisReport(projectStatus, measures, result);
  }

  constructor(projectStatus: ProjectStatus, measures: Measure[], result: AnalysisResult) {
    this.projectStatus = projectStatus;
    this.measures = measures;
    this.result = result;
  }

  public getFailedConditions() {
    return this.projectStatus.conditions.filter((condition) =>
      ["WARN", "ERROR"].includes(condition.status.toUpperCase()),
    );
  }

  public getHtmlAnalysisReport() {
    tl.debug("Generate analysis report.");

    const html = htmlMainDiv(
      [
        htmlQualityGateHeader(this.projectStatus, this.result.projectName),
        htmlSeparator(),
        this.getHtmlQualityGateDetailSection(),
        this.getHtmlDashboardLink(),
      ].join(""),
    );

    return html;
  }

  private getHtmlQualityGateDetailFailedSection() {
    const rows = this.getFailedConditions().map((condition) => {
      const metric = this.result.metrics.find((metric) => metric.key === condition.metricKey);
      if (!metric) {
        return null;
      }
      const threshold =
        condition.status === "WARN" ? condition.warningThreshold : condition.errorThreshold;
      const requiredContent =
        (metric.type !== "RATING" ? formatMeasure(condition.comparator, "COMPARATOR") + " " : "") +
        formatMeasure(threshold, metric.type);

      return htmlMetricListItem(
        "❌",
        `${formatMeasure(condition.actualValue, metric.type)} ${metric.name}`,
        requiredContent,
      );
    });

    return rows.length > 0 ? htmlSectionDiv("Failed Conditions", htmlMetricList(rows)) : "";
  }

  private getHtmlMeasureListItem(icon: string, metricKey: string, metricName: string) {
    const condition = this.projectStatus.conditions.find((c) => c.metricKey === metricKey);
    const measure = this.measures.find((m) => m.metric === metricKey);
    const metric = this.result.metrics.find((m) => m.key === metricKey);

    // Try to get the value from the measure, then from the condition
    const value = measure?.period?.value ?? measure?.value ?? condition?.actualValue;

    if (!metric || typeof value === "undefined") {
      return "";
    }

    return htmlMetricListItem(icon, `${formatMeasure(value, metric.type)} ${metricName}`);
  }

  private getHtmlQualityGateDetailPassedSection() {
    const issuesItems = [
      this.getHtmlMeasureListItem("✅", "new_violations", "new issues"),
      this.getHtmlMeasureListItem("🔧", "pull_request_fixed_issues", "fixed issues"),
      this.getHtmlMeasureListItem("💤", "new_accepted_issues", "accepted issues"),
    ].filter((item) => item.length > 0);
    const issuesSection =
      issuesItems.length > 0 ? htmlSectionDiv("Issues", htmlMetricList(issuesItems)) : "";

    const measuresItems = [
      this.getHtmlMeasureListItem("✅", "new_security_hotspots", "Security Hotspots"),
      this.getHtmlMeasureListItem("✅", "new_coverage", "Coverage on new code"),
      this.getHtmlMeasureListItem("✅", "new_duplicated_lines_density", "Duplications on new code"),
    ].filter((item) => item.length > 0);
    const measuresSection =
      measuresItems.length > 0 ? htmlSectionDiv("Measures", htmlMetricList(measuresItems)) : "";

    return issuesSection + measuresSection;
  }

  private getHtmlQualityGateDetailSection() {
    if (!this.result.metrics) {
      return "";
    }

    if (["WARN", "ERROR"].includes(this.projectStatus.status)) {
      return this.getHtmlQualityGateDetailFailedSection();
    } else {
      return this.getHtmlQualityGateDetailPassedSection();
    }
  }

  private getHtmlDashboardLink() {
    if (!this.result.dashboardUrl) {
      return "";
    }

    return htmlDiv(
      `margin-top: 24px;
      padding-left: 28px;`,
      htmlLink("", this.result.dashboardUrl, "See analysis details on SonarQube"),
    );
  }
}
