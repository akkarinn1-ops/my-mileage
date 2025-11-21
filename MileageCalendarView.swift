import SwiftUI

// MARK: - モデル

/// 1日の走行データ
struct DayMileage: Identifiable {
    let id = UUID()
    let date: Date
    let distance: Double?   // その日の走行距離（+◯km）
    let odometer: Double?   // 積算距離（km）
}

/// 1週間分のデータ
struct WeekMileage: Identifiable {
    let id = UUID()
    let startOfWeek: Date
    let days: [DayMileage]  // 最大7日分（日〜土）

    /// 週合計距離
    var totalDistance: Double {
        days.compactMap { $0.distance }.reduce(0, +)
    }

    /// 例: "11/2週"
    var title: String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "ja_JP")
        df.dateFormat = "M/d"
        return df.string(from: startOfWeek) + "週"
    }
}

// MARK: - 日セル

struct DayMileageCellView: View {
    let day: DayMileage
    let isSelected: Bool

    private var dayString: String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "ja_JP")
        df.dateFormat = "d（E）"
        return df.string(from: day.date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // 日付（小さめ）
            Text(dayString)
                .font(.caption)
                .foregroundColor(.secondary)

            // 距離（+◯km を緑でメイン表示）
            if let distance = day.distance {
                Text(String(format: "+%.0fkm", distance))
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.green)
            } else {
                Text("—")
                    .font(.title3.weight(.regular))
                    .foregroundColor(.secondary)
            }

            // 積算距離（色付き）
            if let odo = day.odometer {
                Text(String(format: "%.0fkm", odo))
                    .font(.footnote)
                    .foregroundColor(Color.blue)
            }
        }
        .frame(width: 130, alignment: .leading) // 横長前提
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? Color.blue : Color(.systemGray4),
                        lineWidth: isSelected ? 2 : 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

// MARK: - 週スクロールビュー

struct MileageWeekScrollView: View {
    let month: Date                         // 表示中の月
    let weeks: [WeekMileage]               // その月に含まれる週データ
    let monthTotalDistance: Double         // 月合計距離

    // ここは既存の月切り替えロジックと繋げる用にクロージャにしておく
    var onPrevMonth: (() -> Void)?
    var onNextMonth: (() -> Void)?

    @State private var selectedDate: Date?

    private var monthTitle: String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "ja_JP")
        df.dateFormat = "yyyy年 M月"
        return df.string(from: month)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {

            // 月ヘッダ
            HStack {
                Button("＜ 前月") {
                    onPrevMonth?()
                }
                Spacer()
                Text(monthTitle)
                    .font(.headline)
                Spacer()
                Button("次月 ＞") {
                    onNextMonth?()
                }
            }
            .padding(.horizontal)

            // 横スクロール 週ビュー
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 16) {
                    ForEach(weeks) { week in
                        VStack(alignment: .leading, spacing: 8) {

                            // 週タイトル（例: 11/9週）
                            Text(week.title)
                                .font(.subheadline.weight(.semibold))
                                .padding(.bottom, 4)

                            // 各日セル
                            ForEach(week.days) { day in
                                Button {
                                    selectedDate = day.date
                                } label: {
                                    DayMileageCellView(
                                        day: day,
                                        isSelected: selectedDate.map {
                                            Calendar.current.isDate($0,
                                                                    inSameDayAs: day.date)
                                        } ?? false
                                    )
                                }
                                .buttonStyle(.plain)
                            }

                            Divider()

                            // 週合計：+◯km
                            Text(String(format: "週合計：+%.0fkm", week.totalDistance))
                                .font(.footnote.weight(.semibold))
                                .foregroundColor(.green)
                        }
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color(.systemGray6))
                        )
                    }
                }
                .padding(.horizontal)
            }

            // 月合計距離
            Text(String(format: "この月の合計：%.0fkm", monthTotalDistance))
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal)
                .padding(.top, 4)

            // ▼ この下に「オド(km)」「区間距離(km)」などの
            //    既存の入力セクションをそのまま置くイメージ
            MileageInputSectionPlaceholder()
                .padding(.top, 8)
        }
    }
}

// MARK: - 入力セクションのプレースホルダ
// 実際は、今使っている入力フォームViewに差し替えてOK
struct MileageInputSectionPlaceholder: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("（ここに既存の入力UIを配置）")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.bottom)
    }
}

// MARK: - プレビュー用ダミーデータ
#if DEBUG
struct MileageWeekScrollView_Previews: PreviewProvider {
    static var previews: some View {
        let calendar = Calendar.current
        let today = Date()

        // 適当なダミーデータ
        let days: [DayMileage] = (0..<7).map { offset in
            let date = calendar.date(byAdding: .day, value: offset, to: today)!
            let distance: Double? = [nil, 39, 81, 90, 173, 182, 192].randomElement()!
            let odo: Double? = distance.map { 153_000 + Double(offset) * 100 + $0 }
            return DayMileage(date: date, distance: distance, odometer: odo)
        }

        let week = WeekMileage(startOfWeek: today, days: days)

        MileageWeekScrollView(
            month: today,
            weeks: [week],
            monthTotalDistance: 1_197,
            onPrevMonth: nil,
            onNextMonth: nil
        )
    }
}
#endif
